"""
Full light-curve -> detection pipeline.

Mirrors `model/tessnet.ipynb`: take a light curve (from an uploaded CSV or a
TESS TIC ID), clean and flatten it, find the dominant period with Box Least
Squares, phase-fold it, render the fold as the white-background / black-scatter
image the ResNet18 was trained on, and classify that image.

Returns a JSON-serialisable dict containing the physical parameters, the model
classification, the rendered model-input image, and down-sampled time series so
the dashboard can repopulate every panel from real data.

The heavy scientific dependencies (lightkurve, matplotlib, astropy) are imported
lazily so the rest of the app still runs if they are absent.
"""

import base64
import io

import numpy as np

import model_service


def pipeline_available():
    """True if the scientific stack for CSV/TIC analysis is installed.

    Uses find_spec so the index route never actually imports lightkurve or
    matplotlib (importing matplotlib can trigger a slow font-cache build and a
    significant memory spike — enough to OOM a small host on boot).
    """
    import importlib.util

    return (importlib.util.find_spec("lightkurve") is not None
            and importlib.util.find_spec("matplotlib") is not None)


def _downsample(x, y, n=400):
    """Evenly thin two arrays to at most n points for transport to the client."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    mask = np.isfinite(x) & np.isfinite(y)
    x, y = x[mask], y[mask]
    if x.size > n:
        idx = np.linspace(0, x.size - 1, n).astype(int)
        x, y = x[idx], y[idx]
    return [{"x": round(float(a), 6), "y": round(float(b), 6)} for a, b in zip(x, y)]


def _render_fold(fold_time, fold_flux):
    """Render the folded curve exactly as the training notebook did.

    Uses matplotlib's object-oriented API (Figure + Agg canvas) rather than
    pyplot. pyplot keeps a global figure registry and is not thread-safe, so
    concurrent CSV/TIC requests on a threaded worker could corrupt state; a
    standalone Figure has no shared state.
    """
    from matplotlib.figure import Figure
    from matplotlib.backends.backend_agg import FigureCanvasAgg

    fig = Figure(figsize=(3, 3), dpi=85)
    FigureCanvasAgg(fig)
    ax = fig.subplots()
    ax.scatter(fold_time, fold_flux, s=1, c="black", alpha=0.5)
    ax.axis("off")
    ax.margins(0, 0)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0, facecolor="white")
    return buf.getvalue()


def _process(lc, raw_time=None, raw_flux=None):
    """Shared processing for a lightkurve LightCurve object."""
    import lightkurve as lk  # noqa: F401  (ensures dependency present)

    # Raw (for the "noisy light curve" panel) — normalise to relative flux so it
    # shares the dashboard's ~1.0 baseline regardless of the detector units.
    if raw_time is None or raw_flux is None:
        raw_time = np.asarray(lc.time.value, dtype=float)
        raw_flux = np.asarray(lc.flux.value, dtype=float)
    raw_time = np.asarray(raw_time, dtype=float)
    raw_flux = np.asarray(raw_flux, dtype=float)
    med = np.nanmedian(raw_flux)
    raw_rel = raw_flux / med if med and np.isfinite(med) else raw_flux

    # 1. Clean and flatten.
    lc = lc.remove_nans().remove_outliers(sigma_upper=3, sigma_lower=20)
    if lc.time.value.size < 150:
        raise ValueError("Too few valid points after cleaning to analyse (need ~150+).")

    # Flatten, search and fold. Wrap the heavy lightkurve calls so opaque
    # failures (short baseline, sparse sampling, periodogram errors) surface as
    # a readable message instead of a stack trace.
    try:
        flat = lc.flatten(window_length=101)

        t = np.asarray(flat.time.value, dtype=float)
        f = np.asarray(flat.flux.value, dtype=float)

        # 2. Box Least Squares period search.
        pg = flat.to_periodogram(method="bls", period=np.arange(0.5, 20, 0.01))
        period = float(pg.period_at_max_power.value)
        t0 = float(pg.transit_time_at_max_power.value)
        duration = float(pg.duration_at_max_power.value)
        depth = float(pg.depth_at_max_power.value)

        # 3. Phase-fold.
        folded = flat.fold(period=pg.period_at_max_power,
                           epoch_time=pg.transit_time_at_max_power)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(
            "Could not run the transit search on this light curve — it may be "
            "too short, too sparsely sampled, or too noisy."
        ) from exc

    fold_t = np.asarray(folded.time.value, dtype=float)
    fold_f = np.asarray(folded.flux.value, dtype=float)

    # 4. Render the model-input image and classify it.
    img_bytes = _render_fold(fold_t, fold_f)
    data_url = "data:image/png;base64," + base64.b64encode(img_bytes).decode("ascii")
    try:
        classification = model_service.predict_image(img_bytes)
        classification["ok"] = True
    except Exception as exc:
        classification = {"ok": False, "error": str(exc)}

    # 5. In-transit indicator over time (a transit "probability" trace derived
    #    from the recovered ephemeris) + a simple transit SNR.
    phase = ((t - t0 + 0.5 * period) % period) - 0.5 * period
    in_transit = np.abs(phase) < (0.5 * max(duration, 1e-6))
    prob = in_transit.astype(float)

    oot = f[~in_transit]
    sigma = float(np.nanstd(oot)) if oot.size else float(np.nanstd(f))
    n_in = int(in_transit.sum())
    snr = float((depth / sigma) * np.sqrt(max(n_in, 1))) if sigma > 0 else 0.0

    return {
        "ok": True,
        "params": {
            "period_days": round(period, 4),
            "duration_hours": round(duration * 24.0, 2),
            "depth_pct": round(depth * 100.0, 3),
            "snr": round(snr, 1),
        },
        "classification": classification,
        "image": data_url,
        "n_points": int(t.size),
        "series": {
            "raw": _downsample(raw_time, raw_rel, 400),
            "denoised": _downsample(t, f, 400),
            "probability": _downsample(t, prob, 600),
            "folded": _downsample(fold_t, fold_f, 800),
        },
    }


def run_csv(file_bytes):
    """Analyse a user-uploaded CSV with time/flux columns."""
    import lightkurve as lk
    import pandas as pd

    df = pd.read_csv(io.BytesIO(file_bytes))
    if df.shape[1] < 2:
        raise ValueError("CSV needs at least two columns (time, flux).")

    lower = {c.lower().strip(): c for c in df.columns}
    tcol = lower.get("time") or lower.get("t") or df.columns[0]
    fcol = (lower.get("flux") or lower.get("pdcsap_flux")
            or lower.get("sap_flux") or df.columns[1])

    time = pd.to_numeric(df[tcol], errors="coerce").to_numpy(dtype=float)
    flux = pd.to_numeric(df[fcol], errors="coerce").to_numpy(dtype=float)
    good = np.isfinite(time) & np.isfinite(flux)
    time, flux = time[good], flux[good]
    if time.size < 150:
        raise ValueError("Not enough valid rows to analyse (need ~150+).")

    lc = lk.LightCurve(time=time, flux=flux)
    return _process(lc, raw_time=time, raw_flux=flux)


def run_tic(tic_id):
    """Download a TESS light curve for a TIC ID and analyse it."""
    import lightkurve as lk

    tic_id = str(tic_id).strip().upper().replace("TIC", "").strip()
    if not tic_id:
        raise ValueError("Enter a TIC ID.")

    try:
        search = lk.search_lightcurve(f"TIC {tic_id}", mission="TESS", author="SPOC")
    except Exception as exc:
        raise ValueError("Could not reach NASA MAST to search for that target.") from exc
    if len(search) == 0:
        raise ValueError(f"No TESS SPOC light curve found for TIC {tic_id}.")

    try:
        lc = search[0].download()
    except Exception as exc:
        raise ValueError(f"Failed to download data for TIC {tic_id} from MAST.") from exc
    if lc is None:
        raise ValueError(f"Failed to download data for TIC {tic_id}.")
    return _process(lc)
