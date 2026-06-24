/*
 * Wires the Detection Result panel to the live TESSNet ResNet18 model.
 * The user uploads a phase-folded light-curve image; it is POSTed to /predict
 * and the classifier output (verdict, confidence, per-class probabilities)
 * replaces the demo values.
 */
(function () {
  const status = window.MODEL_STATUS || { ready: false };
  const input = document.getElementById('lcUpload');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadLabel = document.getElementById('uploadLabel');
  const hint = document.getElementById('uploadHint');
  const verdict = document.getElementById('verdict');
  const verdictText = document.getElementById('verdictText');
  const verdictIcon = document.getElementById('verdictIcon');
  const statConfidence = document.getElementById('statConfidence');
  const probBars = document.getElementById('probBars');
  const classifierSrc = document.getElementById('classifierSrc');

  // If torch/the checkpoint failed to load, disable the control and explain.
  if (!status.ready) {
    uploadBtn.classList.add('disabled');
    input.disabled = true;
    hint.textContent =
      'Model unavailable: ' + (status.error || 'unknown error') +
      '. Install requirements and restart to enable inference.';
    return;
  }

  function renderBars(probabilities) {
    // Highest probability first.
    const rows = probabilities.slice().sort((a, b) => b.p - a.p);
    probBars.innerHTML = '';
    rows.forEach((row) => {
      const el = document.createElement('div');
      el.className = 'prob-row';
      const pct = Math.round(row.p * 100);
      el.innerHTML =
        '<span class="prob-name"></span>' +
        '<span class="prob-track"><i></i></span>' +
        '<span class="prob-val"></span>';
      el.querySelector('.prob-name').textContent = row.label;
      el.querySelector('.prob-val').textContent = row.p.toFixed(2);
      // Animate width on next frame for a subtle transition.
      const bar = el.querySelector('.prob-track i');
      requestAnimationFrame(() => { bar.style.width = pct + '%'; });
      probBars.appendChild(el);
    });
  }

  function applyResult(res) {
    verdictText.textContent = res.transit_detected
      ? 'Transit Detected'
      : res.predicted_label;
    verdictIcon.textContent = res.transit_detected ? '✓' : '✕';
    verdict.classList.toggle('negative', !res.transit_detected);
    statConfidence.textContent = res.confidence.toFixed(2);
    renderBars(res.probabilities);
    classifierSrc.textContent = 'uploaded image';
    classifierSrc.classList.add('live');
  }

  input.addEventListener('change', function () {
    const file = input.files && input.files[0];
    if (!file) return;

    uploadLabel.textContent = 'Analyzing…';
    uploadBtn.classList.add('busy');
    hint.textContent = file.name;

    const form = new FormData();
    form.append('image', file);

    fetch('/predict', { method: 'POST', body: form })
      .then((r) => r.json())
      .then((res) => {
        if (!res.ok) throw new Error(res.error || 'Prediction failed');
        applyResult(res);
        uploadLabel.textContent = 'Analyze Another Image';
      })
      .catch((err) => {
        hint.textContent = 'Error: ' + err.message;
        uploadLabel.textContent = 'Analyze Light-Curve Image';
      })
      .finally(() => {
        uploadBtn.classList.remove('busy');
        input.value = '';
      });
  });
})();
