/*
 * Drives the three input modes in the Detection Result panel and pushes the
 * results back onto the dashboard. Each mode accepts a BATCH of inputs:
 *   - Image: one or more phase-folded PNGs -> /predict (classification only).
 *   - CSV:   one or more time/flux files   -> /analyze/csv (full pipeline).
 *   - TIC:   one or more TESS TIC IDs       -> /analyze/tic (full pipeline).
 * Items are processed sequentially with a progress bar; the dashboard updates
 * live as each finishes, every result is listed (click to re-display), and all
 * outputs can be downloaded together as a single JSON file.
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
  const downloadBtn = $('downloadBtn');
  const batchProgress = $('batchProgress');
  const batchProgressLabel = $('batchProgressLabel');
  const batchProgressCount = $('batchProgressCount');
  const batchBar = $('batchBar');
  const batchResultsEl = $('batchResults');

  // Results of the most recent (batch) run: [{ source, ok, result?, error? }].
  let batchResults = [];
  let running = false;

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

  // ---- Progress bar ----
  function showProgress(total) {
    batchBar.style.width = '0%';
    batchProgressCount.textContent = '0 / ' + total;
    batchProgressLabel.textContent = total > 1 ? 'Processing batch' : 'Processing';
    batchProgress.hidden = false;
  }
  function setProgress(done, total) {
    batchBar.style.width = Math.round((done / total) * 100) + '%';
    batchProgressCount.textContent = done + ' / ' + total;
  }

  // ---- Result helpers ----
  // A pipeline result carries `params`; an image result is the bare classification.
  function isPipeline(res) { return !!(res && res.params); }
  function classOf(res) { return isPipeline(res) ? res.classification : res; }

  // Push one result onto the dashboard panels.
  function display(res, sourceLabel) {
    if (isPipeline(res)) {
      if (res.series && window.Dashboard) window.Dashboard.applySeries(res.series);
      if (res.params) applyParams(res.params);
      if (res.image) showFoldImage(res.image);
      applyClassification(res.classification, sourceLabel);
    } else {
      applyClassification(res, sourceLabel);
      resetBlsStats();   // image classifier yields no BLS parameters
    }
  }

  function reDisplay(index) {
    const entry = batchResults[index];
    if (!entry || !entry.ok) return;
    display(entry.result, entry.source);
    setStatus('Showing ' + entry.source, 'ok');
  }

  // ---- Per-item results list (each row re-displays its result on click) ----
  function clearResults() { batchResultsEl.innerHTML = ''; batchResultsEl.hidden = true; }

  function addResultRow(entry, index) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'batch-row' + (entry.ok ? '' : ' failed');
    const name = document.createElement('span');
    name.className = 'br-name';
    name.textContent = entry.source;

    if (entry.ok) {
      const cls = classOf(entry.result);
      const detected = !!(cls && cls.transit_detected);
      const conf = cls && typeof cls.confidence === 'number' ? cls.confidence.toFixed(2) : '—';
      const meta = isPipeline(entry.result) ? (entry.result.params.period_days + ' d') : 'image';
      row.innerHTML = '<span class="br-icon">' + (detected ? '✓' : '✕') + '</span>';
      row.appendChild(name);
      row.insertAdjacentHTML('beforeend',
        '<span class="br-meta">' + meta + '</span><span class="br-conf">' + conf + '</span>');
      row.title = 'Show ' + entry.source;
      row.addEventListener('click', function () { reDisplay(index); });
    } else {
      row.innerHTML = '<span class="br-icon err">!</span>';
      row.appendChild(name);
      row.insertAdjacentHTML('beforeend', '<span class="br-meta">failed</span>');
      row.title = entry.error || 'Failed';
    }
    batchResultsEl.appendChild(row);
    batchResultsEl.hidden = false;
  }

  // ---- POST one item ----
  function runOne(item) {
    const form = new FormData();
    if (item.kind === 'image') { form.append('image', item.file); return post('/predict', form); }
    if (item.kind === 'csv') { form.append('file', item.file); return post('/analyze/csv', form); }
    form.append('tic_id', item.tic); return post('/analyze/tic', form);
  }

  // ---- Sequential batch runner ----
  function runBatch(items) {
    if (running) return Promise.resolve();
    batchResults = [];
    clearResults();
    downloadBtn.hidden = true;
    if (!items.length) { setStatus('Nothing to process.', 'error'); return Promise.resolve(); }
    running = true;
    showProgress(items.length);

    let i = 0, failed = 0;

    function finish() {
      running = false;
      const ok = items.length - failed;
      if (batchResults.some((e) => e.ok)) downloadBtn.hidden = false;
      downloadBtn.textContent = items.length > 1
        ? '↓ Download All Results (JSON)'
        : '↓ Download Results (JSON)';
      setStatus('Done — ' + ok + ' of ' + items.length + ' succeeded'
        + (failed ? ', ' + failed + ' failed' : '') + '.',
        failed ? (ok ? 'ok' : 'error') : 'ok');
      return Promise.resolve();
    }

    function next() {
      if (i >= items.length) return finish();
      const item = items[i];
      setStatus('Processing ' + item.label + '  (' + (i + 1) + ' / ' + items.length + ')…');
      return runOne(item).then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Failed');
        const entry = { source: item.label, ok: true, result: res };
        batchResults.push(entry);
        display(res, item.label);                                  // live update
        if (item.kind === 'image') showFoldImage(URL.createObjectURL(item.file), true);
        addResultRow(entry, batchResults.length - 1);
      }).catch(function (err) {
        failed++;
        const entry = { source: item.label, ok: false, error: err.message };
        batchResults.push(entry);
        addResultRow(entry, batchResults.length - 1);
      }).then(function () {
        i += 1;
        setProgress(i, items.length);
        return next();
      });
    }
    return next();
  }

  // ---- Download all results as one JSON ----
  function slugify(s) {
    return (s || 'result').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'result';
  }

  function itemPayload(entry) {
    if (!entry.ok) return { source: entry.source, ok: false, error: entry.error };
    const res = entry.result;
    const cls = classOf(res);
    const out = {
      source: entry.source,
      ok: true,
      classification: cls ? {
        predicted: cls.predicted,
        predicted_label: cls.predicted_label,
        confidence: cls.confidence,
        transit_detected: cls.transit_detected,
        probabilities: cls.probabilities,
      } : null,
    };
    if (isPipeline(res)) {
      out.n_points_analyzed = res.n_points;
      out.parameters = res.params;
      out.series = res.series;
    }
    return out;
  }

  function downloadResults() {
    if (!batchResults.length) return;
    const succeeded = batchResults.filter((e) => e.ok).length;
    const payload = {
      tool: 'ISRO BAH 2026 — TESSNet exoplanet transit detection',
      generated_at: new Date().toISOString(),
      count: batchResults.length,
      succeeded: succeeded,
      failed: batchResults.length - succeeded,
      series_note: 'Time series are downsampled for display; parameters and '
        + 'classification are computed on the full-resolution light curve.',
      results: batchResults.map(itemPayload),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = (batchResults.length === 1
      ? 'tessnet-' + slugify(batchResults[0].source)
      : 'tessnet-batch-' + batchResults.length + '-items') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  downloadBtn.addEventListener('click', downloadResults);

  // ---- Image mode (classification, one or more files) ----
  if (status.ready) {
    const imageInput = $('lcImage');
    const imageLabel = $('imageLabel');
    imageInput.addEventListener('change', function () {
      if (!imageInput.files || !imageInput.files.length) return;
      imageLabel.textContent = 'Analyzing…';
      const items = Array.prototype.map.call(imageInput.files, function (f) {
        return { kind: 'image', label: f.name, file: f };
      });
      runBatch(items).then(function () {
        imageLabel.textContent = 'Upload Phase-folded Image(s)';
        imageInput.value = '';
      });
    });
  } else {
    $('imageBtn').classList.add('disabled');
    $('lcImage').disabled = true;
    setStatus('Model unavailable: ' + (status.error || 'unknown'), 'error');
  }

  // ---- CSV + TIC modes (require the scientific pipeline) ----
  if (pipelineOK) {
    const csvInput = $('lcCsv');
    const csvLabel = $('csvLabel');
    csvInput.addEventListener('change', function () {
      if (!csvInput.files || !csvInput.files.length) return;
      csvLabel.textContent = 'Analyzing…';
      const items = Array.prototype.map.call(csvInput.files, function (f) {
        return { kind: 'csv', label: f.name, file: f };
      });
      runBatch(items).then(function () {
        csvLabel.textContent = 'Upload Light-curve CSV(s)';
        csvInput.value = '';
      });
    });

    const ticInput = $('ticInput');
    const ticBtn = $('ticBtn');
    const runTic = function () {
      const ids = ticInput.value.split(/[\s,]+/)
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      if (!ids.length) { setStatus('Enter one or more TIC IDs.', 'error'); return; }
      ticBtn.textContent = '…';
      ticBtn.disabled = true;
      const items = ids.map(function (id) { return { kind: 'tic', label: 'TIC ' + id, tic: id }; });
      runBatch(items).then(function () {
        ticBtn.textContent = 'Run';
        ticBtn.disabled = false;
      });
    };
    ticBtn.addEventListener('click', runTic);
    ticInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') runTic(); });
  } else {
    ['csvBtn', 'ticBtn'].forEach(function (id) { const el = $(id); if (el) el.classList.add('disabled'); });
    document.querySelectorAll('[data-pane="csv"] .analyze-hint, [data-pane="tic"] .analyze-hint')
      .forEach(function (el) { el.textContent = 'Install lightkurve + matplotlib and restart to enable this mode.'; });
    const csv = $('lcCsv'); if (csv) csv.disabled = true;
    const tic = $('ticInput'); if (tic) tic.disabled = true;
  }
})();
