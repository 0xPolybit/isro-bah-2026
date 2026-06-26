/*
 * Drives the three input modes in the Detection Result panel and pushes the
 * results back onto the dashboard:
 *   - Image: upload a phase-folded PNG -> /predict (classification only).
 *   - CSV:   upload time/flux data    -> /analyze/csv (full pipeline).
 *   - TIC:   enter a TESS TIC ID       -> /analyze/tic (full pipeline).
 * CSV and TIC repopulate every panel via window.Dashboard.applySeries().
 */
(function () {
  const status = window.MODEL_STATUS || { ready: false };
  const pipelineOK = !!window.PIPELINE_AVAILABLE;

  const $ = (id) => document.getElementById(id);
  const verdict = $('verdict');
  const verdictText = $('verdictText');
  const verdictIcon = $('verdictIcon');
  const probBars = $('probBars');
  const classifierSrc = $('classifierSrc');
  const statConfidence = $('statConfidence');
  const statPeriod = $('statPeriod');
  const statDepth = $('statDepth');
  const statDuration = $('statDuration');
  const statSnr = $('statSnr');
  const foldImage = $('foldImage');
  const phaseCanvas = $('phaseChart');
  const statusEl = $('analyzeStatus');

  // ---- Tab switching ----
  const tabs = document.querySelectorAll('.analyze-tab');
  const panes = document.querySelectorAll('.analyze-pane');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panes.forEach((p) => {
        const on = p.dataset.pane === mode;
        p.classList.toggle('active', on);
        p.hidden = !on;
      });
      hideFoldImage();   // don't carry a previous run's image across modes
      setStatus('');
    });
  });

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'analyze-status' + (kind ? ' ' + kind : '');
  }

  // ---- Shared result rendering ----
  function renderBars(probabilities) {
    const rows = probabilities.slice().sort((a, b) => b.p - a.p);
    probBars.innerHTML = '';
    rows.forEach((row) => {
      const el = document.createElement('div');
      el.className = 'prob-row';
      el.innerHTML =
        '<span class="prob-name"></span>' +
        '<span class="prob-track"><i></i></span>' +
        '<span class="prob-val"></span>';
      el.querySelector('.prob-name').textContent = row.label;
      el.querySelector('.prob-val').textContent = row.p.toFixed(2);
      const bar = el.querySelector('.prob-track i');
      requestAnimationFrame(() => { bar.style.width = Math.round(row.p * 100) + '%'; });
      probBars.appendChild(el);
    });
  }

  function applyClassification(cls, sourceLabel) {
    if (!cls || cls.ok === false) {
      setStatus('Classification failed: ' + ((cls && cls.error) || 'unknown'), 'error');
      return;
    }
    verdictText.textContent = cls.transit_detected ? 'Transit Detected' : cls.predicted_label;
    verdictIcon.textContent = cls.transit_detected ? '✓' : '✕';
    verdict.classList.toggle('negative', !cls.transit_detected);
    statConfidence.textContent = cls.confidence.toFixed(2);
    renderBars(cls.probabilities);
    classifierSrc.textContent = sourceLabel;
    classifierSrc.classList.add('live');
  }

  function applyParams(p) {
    statPeriod.textContent = p.period_days + ' days';
    statDepth.textContent = p.depth_pct + '%';
    statDuration.textContent = p.duration_hours + ' hours';
    statSnr.textContent = String(p.snr);
  }

  // The BLS parameters come from the full pipeline, not the image classifier,
  // so blank them out for image-only runs rather than leaving stale numbers.
  function resetBlsStats() {
    statPeriod.textContent = '—';
    statDepth.textContent = '—';
    statDuration.textContent = '—';
    statSnr.textContent = '—';
  }

  // The fold image overlays the phase chart. Track object URLs so they can be
  // revoked (otherwise each upload leaks one).
  let lastBlobUrl = null;
  function showFoldImage(url, isBlob) {
    if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
    if (isBlob) lastBlobUrl = url;
    foldImage.src = url;
    foldImage.hidden = false;
    phaseCanvas.style.visibility = 'hidden';
  }
  function hideFoldImage() {
    if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
    foldImage.hidden = true;
    foldImage.removeAttribute('src');
    phaseCanvas.style.visibility = 'visible';
  }

  // ---- POST helper ----
  function post(url, body) {
    return fetch(url, { method: 'POST', body: body }).then((r) => r.json());
  }

  // ---- Image mode (classification only) ----
  if (status.ready) {
    const imageInput = $('lcImage');
    const imageLabel = $('imageLabel');
    imageInput.addEventListener('change', () => {
      const file = imageInput.files && imageInput.files[0];
      if (!file) return;
      imageLabel.textContent = 'Analyzing…';
      setStatus(file.name);
      const form = new FormData();
      form.append('image', file);
      post('/predict', form)
        .then((res) => {
          if (!res.ok) throw new Error(res.error || 'Prediction failed');
          applyClassification(res, 'uploaded image');
          resetBlsStats();   // image classifier yields no BLS parameters
          showFoldImage(URL.createObjectURL(file), true);
          setStatus('Classified uploaded image.', 'ok');
        })
        .catch((err) => setStatus('Error: ' + err.message, 'error'))
        .finally(() => { imageLabel.textContent = 'Upload Phase-folded Image'; imageInput.value = ''; });
    });
  } else {
    $('imageBtn').classList.add('disabled');
    $('lcImage').disabled = true;
    setStatus('Model unavailable: ' + (status.error || 'unknown'), 'error');
  }

  // ---- Full-pipeline result handler (CSV + TIC) ----
  function handlePipeline(res, sourceLabel) {
    if (!res.ok) throw new Error(res.error || 'Analysis failed');
    if (res.series && window.Dashboard) window.Dashboard.applySeries(res.series);
    if (res.params) applyParams(res.params);
    if (res.image) showFoldImage(res.image);
    applyClassification(res.classification, sourceLabel);
    setStatus('Analyzed ' + res.n_points + ' cadences.', 'ok');
  }

  // ---- CSV + TIC modes (require the scientific pipeline) ----
  if (pipelineOK) {
    const csvInput = $('lcCsv');
    const csvLabel = $('csvLabel');
    csvInput.addEventListener('change', () => {
      const file = csvInput.files && csvInput.files[0];
      if (!file) return;
      csvLabel.textContent = 'Analyzing…';
      setStatus('Processing ' + file.name + ' (folding + BLS)…');
      const form = new FormData();
      form.append('file', file);
      post('/analyze/csv', form)
        .then((res) => handlePipeline(res, 'CSV: ' + file.name))
        .catch((err) => setStatus('Error: ' + err.message, 'error'))
        .finally(() => { csvLabel.textContent = 'Upload Light-curve CSV'; csvInput.value = ''; });
    });

    const ticInput = $('ticInput');
    const ticBtn = $('ticBtn');
    const runTic = () => {
      const id = ticInput.value.trim();
      if (!id) { setStatus('Enter a TIC ID.', 'error'); return; }
      ticBtn.textContent = '…';
      ticBtn.disabled = true;
      setStatus('Downloading TIC ' + id + ' from MAST…');
      const form = new FormData();
      form.append('tic_id', id);
      post('/analyze/tic', form)
        .then((res) => handlePipeline(res, 'TIC ' + id))
        .catch((err) => setStatus('Error: ' + err.message, 'error'))
        .finally(() => { ticBtn.textContent = 'Run'; ticBtn.disabled = false; });
    };
    ticBtn.addEventListener('click', runTic);
    ticInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTic(); });
  } else {
    ['csvBtn', 'ticBtn'].forEach((id) => { const el = $(id); if (el) el.classList.add('disabled'); });
    document.querySelectorAll('[data-pane="csv"] .analyze-hint, [data-pane="tic"] .analyze-hint')
      .forEach((el) => { el.textContent = 'Install lightkurve + matplotlib and restart to enable this mode.'; });
    const csv = $('lcCsv'); if (csv) csv.disabled = true;
    const tic = $('ticInput'); if (tic) tic.disabled = true;
  }
})();
