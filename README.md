<div align="center">

<img src="frontend/assets/icon.png" alt="ISRO BAH 2026 logo" width="110" />

# ISRO BAH 2026
### AI Exoplanet Transit Detection Pipeline

*The Escapists — Bharatiya Antariksh Hackathon 2026*

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue?style=flat-square)](LICENSE)
[![TESS](https://img.shields.io/badge/Data-NASA%20TESS-0B3D91?style=flat-square)](https://tess.mit.edu/)
[![Chart.js](https://img.shields.io/badge/Charts-Chart.js-FF6384?style=flat-square&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![Paper](https://img.shields.io/badge/Paper-PDF-success?style=flat-square)](paper/tessnet.pdf)

</div>

---

An AI-based pipeline and dashboard for **automatically detecting exoplanet transit signals in noisy astronomical light-curve data**. Transit photometry hunts for the tiny, periodic dips in a star's brightness caused by a planet crossing its disk. In crowded fields these signals are buried under detector noise and contamination from blended foreground/background sources, and they are easily confused with eclipsing binaries or starspots. This project pairs a deep-learning classifier with an interactive mission-control dashboard to surface and explain candidate transits.

---

## Features

| | |
|---|---|
| 📊 **Interactive Dashboard** | Visualises the full detection workflow across five panels: raw light curve, AI pipeline diagram, denoised signal, transit probability over time, and a phase-folded detection summary. |
| 🔭 **Three Input Modes** | Feed the model a phase-folded **image**, a `time,flux` **CSV**, or a TESS **TIC ID**. CSV/TIC run the full pipeline server-side and repopulate *every* panel from the real data. |
| 📦 **Batch & Export** | Submit many inputs at once (multiple files or a list of TIC IDs); they process sequentially with a live progress bar, and all results download together as one JSON file. |
| 🤖 **Live Model Inference** | The trained ResNet18 classifier returns a verdict, confidence score, and per-class probability bars — updated in real time. |
| 🧭 **Guided Onboarding** | A first-visit welcome and an "Analyze Your Data" call-to-action point newcomers to the input panel; the default view is a clearly-labelled **sample**, not stored data. |
| 🔍 **Help & Detail Views** | Every section has a `?` explainer and a fullscreen ⤢ expand that opens an in-depth reference panel (and a detailed pipeline flowchart). |
| 🎨 **Design System** | Single-screen dark layout, sharp corners, greyscale + electric blue (`#00e8f7`), subtle animations, and an icon splash/loading screen. Documented in [`DESIGN.md`](DESIGN.md). |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | [Python](https://www.python.org/) · [Flask](https://flask.palletsprojects.com/) · [gunicorn](https://gunicorn.org/) (production) |
| **ML / Inference** | [PyTorch](https://pytorch.org/) · [torchvision](https://pytorch.org/vision/) (ResNet18) · [Pillow](https://python-pillow.org/) |
| **Frontend** | HTML · CSS · Vanilla JavaScript · [Chart.js](https://www.chartjs.org/) |
| **Analysis & Training** | [Lightkurve](https://docs.lightkurve.org/) · [Astroquery](https://astroquery.readthedocs.io/) · [matplotlib](https://matplotlib.org/) · NumPy |
| **Fonts** | [Bitcount Prop Single](https://fonts.google.com/) (headings) · [Ubuntu](https://fonts.google.com/specimen/Ubuntu) (body) |

---

## The Model

The classifier is a **ResNet18** fine-tuned on 224×224 RGB images of *phase-folded light curves* — black scatter on a white background — normalised with standard ImageNet statistics. The full training process is documented in [`model/tessnet.ipynb`](model/tessnet.ipynb).

```
Raw TESS Data  →  BLS Period Search  →  Phase-fold  →  Render Image  →  ResNet18 Fine-tune
```

1. **Download** TESS light curves via Lightkurve (SPOC pipeline).
2. **Clean** — remove NaNs, sigma-clip outliers, flatten the trend.
3. **BLS periodogram** — find the dominant period, epoch, and duration.
4. **Phase-fold** the light curve and render it as a 224×224 PNG.
5. **Fine-tune** a pre-trained ResNet18 with a custom classification head.

Trained weights ship as `frontend/tess_resnet18_model.pth`. Inference mirrors the notebook's `predict_and_evaluate` function exactly.

> **Class labels:** The checkpoint outputs **2 classes** but does not store their names. They default to `noise` (index 0) and `transits` (index 1), matching torchvision's alphabetical `ImageFolder` ordering. If your training set used a different pair, update the `CLASS_NAMES` list at the top of [`frontend/model_service.py`](frontend/model_service.py).

---

## Project Structure

```
isro-bah-2026/
│
├── DESIGN.md                    # Visual & interaction design principles
├── LICENSE                      # GNU GPL v3
├── README.md
├── render.yaml                  # Render deployment blueprint
│
├── model/
│   ├── tessnet.ipynb            # Data preparation + ResNet18 training
│   └── sample_data/             # Example light-curve samples
│
├── paper/
│   ├── tessnet.tex             # LaTeX source of the project paper
│   └── tessnet.pdf             # Compiled paper
│
└── frontend/
    ├── app.py                   # Flask application & API routes
    ├── model_service.py         # Model loading, lazy init & inference
    ├── pipeline.py              # CSV/TIC → clean → BLS → fold → render → classify
    ├── gunicorn.conf.py         # Production WSGI server config
    ├── requirements.txt
    ├── tess_resnet18_model.pth  # Trained ResNet18 weights (~45 MB)
    │
    ├── assets/
    │   ├── icon.png             # App icon (favicon + loading splash)
    │   └── tessnet.pdf          # Paper, served via the "Read Paper" button
    │
    ├── templates/
    │   └── index.html           # Main dashboard template
    │
    └── static/
        ├── css/
        │   └── style.css        # Full design-system stylesheet
        └── js/
            ├── data.js          # Synthetic demo light-curve generator
            ├── charts.js        # Chart.js rendering + live-update API
            ├── help.js          # Help modal + fullscreen detail dialog
            ├── details.js       # Extended per-section reference content
            ├── predict.js       # Inputs → batch processing → live results + JSON export
            ├── onboarding.js    # First-visit welcome + "Analyze Your Data" CTA
            └── loader.js        # Splash / loading overlay
```

---

## Installation

> Requires **Python 3.9+**

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/isro-bah-2026.git
cd isro-bah-2026/frontend

# 2. Create and activate a virtual environment (recommended)
python -m venv env

# Windows
env\Scripts\activate
# macOS / Linux
source env/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

`requirements.txt` already pins the **CPU-only** PyTorch wheels (via the PyTorch
CPU index) to keep the install small. If you need a different build, install torch
and torchvision manually, e.g.:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

---

## Usage

### Development server

Start the Flask dev server from the `frontend/` directory:

```bash
python app.py
```

Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser.

### Production (gunicorn)

On Linux/Unix, serve the app with the bundled gunicorn config:

```bash
gunicorn -c gunicorn.conf.py app:app   # serves on 0.0.0.0:8000
```

The config uses 2 workers and a 120 s timeout (BLS period search and MAST
downloads are slow), binds to `$PORT`, and forces matplotlib's headless `Agg`
backend. Tune via `WEB_CONCURRENCY`, `GUNICORN_TIMEOUT`, and `GUNICORN_BIND`.
*(gunicorn does not run on native Windows — use the dev server or `waitress` there.)*

### Deploying to Render

The repo ships a [`render.yaml`](render.yaml) blueprint (root dir `frontend/`,
start command `gunicorn -c gunicorn.conf.py app:app`). The index route is kept
lightweight — the model and analysis libraries load lazily on first use, not on
page load — so the worker boots fast. The full ML stack (torch + lightkurve +
matplotlib) needs more RAM than the free tier, so the blueprint requests the
**Standard** plan.

### Running an analysis

The dashboard opens on a clearly-labelled **sample** view (synthetic data — nothing
is stored between visits). In the **Detection Result** panel, pick one of three
input modes:

| Mode | Input | What happens |
|------|-------|--------------|
| **Image** | A phase-folded light-curve PNG (black scatter, white background) | Classified directly by ResNet18; updates the verdict, confidence and probability bars. |
| **CSV** | A `time,flux` CSV | Server flattens → BLS period search → phase-folds → renders the model image → classifies, then **repopulates every panel** from the real data. |
| **TIC ID** | A TESS TIC ID (e.g. `25155310`) | Downloads the SPOC light curve from NASA MAST and runs the full pipeline. Requires internet access. |

Every mode accepts **multiple inputs** (several files, or a comma/space-separated
list of TIC IDs): they process sequentially with a progress bar, the dashboard
updates live per item, and all results export together as one JSON file.

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/` | Serves the dashboard. |
| `GET`  | `/api/model-status` | Returns model readiness and class labels as JSON. |
| `POST` | `/predict` | Multipart `image` upload → JSON classification result. |
| `POST` | `/analyze/csv` | Multipart `file` (time/flux CSV) → full pipeline result (params, classification, image, series). |
| `POST` | `/analyze/tic` | Form field `tic_id` → downloads from MAST and runs the full pipeline. |

#### Example `/predict` response

```json
{
  "ok": true,
  "predicted": "transits",
  "predicted_label": "Planetary Transit",
  "confidence": 0.97,
  "transit_detected": true,
  "probabilities": [
    { "name": "transits", "label": "Planetary Transit",  "p": 0.97 },
    { "name": "noise",    "label": "Noise / No Transit", "p": 0.03 }
  ]
}
```

---

## License

Released under the [GNU General Public License v3.0](LICENSE).
