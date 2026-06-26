/*
 * Extended, section-specific content shown in the fullscreen dialog's detail
 * panel. Keyed by each card's data-section attribute. Authored as static
 * reference material (transit photometry + the model architecture).
 */
window.SECTION_DETAILS = {
  noisy: `
    <h4>What you are looking at</h4>
    <p>Each point is a single photometric measurement — the star's brightness
    (<strong>relative flux</strong>, normalised so the out-of-transit baseline ≈ 1.0)
    sampled at a fixed <strong>cadence</strong>. TESS records full-frame images at
    200 s and selected targets at 2 min or 20 s; Kepler used 1 min and 30 min modes.</p>

    <h4>Where the noise comes from</h4>
    <ul>
      <li><strong>Photon (shot) noise</strong> — the irreducible √N scatter of counting photons.</li>
      <li><strong>Detector noise</strong> — read noise, dark current, and pixel-to-pixel response.</li>
      <li><strong>Pointing jitter</strong> — spacecraft motion moving the PSF across pixels.</li>
      <li><strong>Scattered light</strong> from the Earth and Moon, strongest near perigee.</li>
      <li><strong>Cosmic rays</strong> and momentum-dump thruster firings, which appear as outliers.</li>
    </ul>

    <h4>Crowded-field contamination</h4>
    <p>In dense fields the photometric aperture collects light from foreground and
    background stars. This <strong>blending</strong> dilutes any transit — the measured
    depth is shallower than the true depth — and a variable contaminant can inject a
    false signal that mimics a planet.</p>

    <h4>Why it is hard</h4>
    <p>A hot Jupiter dims its star by ~1% (10,000&nbsp;ppm), but an Earth across a
    Sun-like star is only ~84&nbsp;ppm — well below the per-point scatter. The signal
    only emerges after combining thousands of measurements.</p>
  `,

  pipeline: `
    <h4>Detailed pipeline</h4>
    <div class="detail-flow">
      <div class="dflow-step">
        <div class="dflow-head"><span class="dflow-num">1</span> Input &amp; Preprocessing</div>
        <ul>
          <li>Remove NaNs; sigma-clip outliers (3σ upper, 20σ lower to keep deep transits)</li>
          <li>Flatten stellar/instrumental trends (Savitzky–Golay, window ≈ 101)</li>
          <li>Box Least Squares period search over 0.5–20 days</li>
          <li>Phase-fold on the best period and render a 224×224 RGB image</li>
        </ul>
      </div>
      <div class="dflow-arrow">↓</div>
      <div class="dflow-step">
        <div class="dflow-head"><span class="dflow-num">2</span> Denoising Autoencoder</div>
        <ul>
          <li>Encoder compresses the noisy curve to a low-dimensional latent code</li>
          <li>Decoder reconstructs a clean curve; trained to minimise reconstruction (MSE) loss</li>
          <li>Learns to suppress incoherent noise while preserving the periodic dip</li>
        </ul>
      </div>
      <div class="dflow-arrow">↓</div>
      <div class="dflow-step">
        <div class="dflow-head"><span class="dflow-num">3</span> Feature Extraction</div>
        <ul>
          <li>ResNet18 convolutional backbone, pre-trained on ImageNet (transfer learning)</li>
          <li>Residual blocks yield a 512-dimensional feature vector</li>
          <li>Early layers frozen; only the head is fine-tuned on light-curve images</li>
        </ul>
      </div>
      <div class="dflow-arrow">↓</div>
      <div class="dflow-step">
        <div class="dflow-head"><span class="dflow-num">4</span> Transit Detection Classifier</div>
        <ul>
          <li>Fully-connected head maps 512 features → class logits</li>
          <li>Softmax converts logits to calibrated class probabilities</li>
        </ul>
      </div>
      <div class="dflow-arrow">↓</div>
      <div class="dflow-step">
        <div class="dflow-head"><span class="dflow-num">5</span> Output</div>
        <ul>
          <li>Predicted class + confidence (e.g. 0.97)</li>
          <li>Flagged as a transit when the transit class wins</li>
        </ul>
      </div>
    </div>
    <h4>Training feedback loop</h4>
    <p>Predictions are compared with labels via cross-entropy loss; gradients are
    back-propagated and weights updated by the Adam optimiser, with a held-out
    validation split monitoring generalisation across epochs.</p>
  `,

  denoised: `
    <h4>From noisy to clean</h4>
    <p>The autoencoder outputs a reconstruction of the input in which incoherent,
    high-frequency scatter is suppressed while the <strong>coherent, repeating</strong>
    transit dip is retained. Because real transits recur on a fixed period, they are
    statistically separable from random noise.</p>

    <h4>Detrending vs. denoising</h4>
    <ul>
      <li><strong>Detrending (flattening)</strong> removes slow trends — stellar rotation,
      long-term instrument drift — usually with a Savitzky–Golay or spline filter.</li>
      <li><strong>Denoising</strong> removes fast, random fluctuations point-to-point.</li>
      <li>Together they raise the transit's signal-to-noise without distorting its shape.</li>
    </ul>

    <h4>What to watch for</h4>
    <p>Over-aggressive smoothing can erode shallow or short transits and round off
    the ingress/egress, biasing the measured depth and duration. The window length
    is chosen to be several times longer than the expected transit.</p>
  `,

  probability: `
    <h4>A transit likelihood at every epoch</h4>
    <p>This trace scores how transit-like the signal is at each point in time.
    Peaks recur at the orbital period; the spacing between peaks <em>is</em> the period.
    Everything below the dashed <strong>detection threshold</strong> is treated as baseline.</p>

    <h4>Choosing the threshold</h4>
    <ul>
      <li>A <strong>lower</strong> threshold catches shallower transits but admits more false positives (higher completeness, lower reliability).</li>
      <li>A <strong>higher</strong> threshold is conservative — fewer candidates, higher purity.</li>
    </ul>

    <h4>Box Least Squares (BLS)</h4>
    <p>BLS fits a periodic box-shaped dip across a grid of period, duration and phase,
    maximising the detection statistic. It is the standard first-pass transit search
    and supplies the ephemeris (period and reference transit time) used here.</p>
  `,

  result: `
    <h4>Parameter glossary</h4>
    <ul>
      <li><strong>Confidence</strong> — the classifier's softmax probability for the winning class.</li>
      <li><strong>Period (P)</strong> — time between successive transits, from the BLS search.</li>
      <li><strong>Depth (δ)</strong> — fractional dimming, ≈ (R<sub>p</sub>/R<sub>★</sub>)² — directly the planet-to-star radius ratio squared.</li>
      <li><strong>Duration</strong> — ingress-to-egress time; set by the period, stellar density and impact parameter.</li>
      <li><strong>SNR</strong> — signal-to-noise of the folded transit, scaling as depth ÷ scatter × √(in-transit points).</li>
    </ul>

    <h4>Why phase-fold?</h4>
    <p>Folding stacks every orbit onto a single transit window at the recovered period.
    Random noise averages down while the transit reinforces, sharpening the shape and
    boosting SNR — which is why the folded curve is far cleaner than the raw series.</p>

    <h4>Vetting a candidate</h4>
    <ul>
      <li><strong>Odd–even test</strong> — unequal alternating depths reveal an eclipsing binary at twice the period.</li>
      <li><strong>Secondary eclipse</strong> — a dip at phase 0.5 indicates a stellar companion, not a planet.</li>
      <li><strong>Centroid shift</strong> — motion of the flux centroid in transit points to a blended background eclipsing binary.</li>
      <li><strong>Shape</strong> — planets give flat-bottomed “U” transits; grazing binaries give “V” shapes.</li>
    </ul>
  `,

  training: `
    <h4>Signal classes the model learns</h4>
    <ul>
      <li><strong>Planetary transit</strong> — shallow, flat-bottomed, U-shaped dips of constant depth, strictly periodic.</li>
      <li><strong>Eclipsing binary</strong> — deeper, often V-shaped eclipses with alternating primary/secondary depths and frequently a secondary eclipse.</li>
      <li><strong>Starspot variability</strong> — smooth, quasi-periodic sinusoidal modulation from spots rotating in and out of view.</li>
      <li><strong>Blended source</strong> — a diluted or injected signal from another star inside the aperture.</li>
    </ul>

    <h4>Other look-alikes worth modelling</h4>
    <ul>
      <li><strong>Pulsating variables</strong> — Cepheids, RR Lyrae and δ Scuti stars with intrinsic brightness oscillations.</li>
      <li><strong>Stellar flares</strong> — sharp brightening spikes with exponential decay (the opposite sign of a transit).</li>
      <li><strong>Instrumental systematics</strong> — momentum dumps, scattered-light ramps and detector artefacts.</li>
    </ul>

    <h4>Why diversity matters</h4>
    <p>Training on a broad mix of true transits and confusers teaches the network the
    morphological differences that let it disentangle genuine planets from astrophysical
    and instrumental false positives — especially in noisy, crowded fields.</p>
  `,

  features: `
    <h4>Capabilities</h4>
    <ul>
      <li>Denoising autoencoder tuned for crowded-field contamination and blending.</li>
      <li>Disentangles planetary transits from eclipsing binaries and starspots.</li>
      <li>Per-epoch transit-probability scoring with a tunable detection threshold.</li>
      <li>Robust to detector-response noise, scattered light and systematics.</li>
      <li>Automated phase-folding and first-pass candidate vetting.</li>
      <li>Transfer learning from an ImageNet-pretrained ResNet18 backbone.</li>
      <li>Operates on a 2-D image representation, exploiting transit morphology rather than raw 1-D flux alone.</li>
      <li>Handles heterogeneous cadences and multiple observing sectors.</li>
      <li>Batch inference scales to survey-sized catalogues.</li>
      <li>Emits calibrated confidence scores for triage and ranking.</li>
      <li>Cuts manual vetting effort by pre-filtering obvious non-transits.</li>
      <li>Extensible to additional classes (planet / EB / variable / noise).</li>
    </ul>
  `,

  applications: `
    <h4>Where it is used</h4>
    <ul>
      <li>TESS, Kepler and K2 survey light-curve analysis.</li>
      <li>Crowded galactic-plane and open-cluster fields with heavy blending.</li>
      <li>Exoplanet candidate prioritisation and ranking.</li>
      <li>Follow-up target selection for radial-velocity and JWST atmospheric studies.</li>
      <li>False-positive rejection ahead of expensive confirmation.</li>
      <li>Real-time triage for transient and alert brokers.</li>
      <li>Pre-screening targets for citizen-science projects (e.g. Planet Hunters).</li>
      <li>Population studies and occurrence-rate statistics from clean candidate samples.</li>
      <li>Pipelines for ground-based surveys such as NGTS, WASP and HATNet.</li>
      <li>Generating labelled training sets for larger time-series models.</li>
      <li>Readiness for future missions like PLATO and the Roman Space Telescope.</li>
    </ul>
  `,
};
