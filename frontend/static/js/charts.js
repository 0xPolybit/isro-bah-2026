/*
 * Chart rendering. All charts share the greyscale + electric-blue theme.
 * No glow effects; subtle, short animations only.
 */
(function () {
  // Provisional no-op so predict.js stays safe until the charts initialise (and
  // permanently if Chart.js never loads at all).
  window.Dashboard = { applySeries: function () {} };

  function start() {
  const ACCENT = '#00e8f7';
  const TEXT = '#e0e0e0';
  const MUTED = '#888888';
  const BORDER = '#333333';
  const GRID = 'rgba(255,255,255,0.05)';

  Chart.defaults.font.family = "'Ubuntu', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = MUTED;
  Chart.defaults.animation.duration = 600;
  Chart.defaults.animation.easing = 'easeOutQuart';

  const axis = (titleX, titleY, yMin, yMax) => ({
    x: {
      type: 'linear',
      title: { display: !!titleX, text: titleX, color: MUTED },
      grid: { color: GRID, drawBorder: false },
      ticks: { color: MUTED, maxTicksLimit: 6 },
      border: { color: BORDER },
    },
    y: {
      min: yMin, max: yMax,
      title: { display: !!titleY, text: titleY, color: MUTED },
      grid: { color: GRID, drawBorder: false },
      ticks: { color: MUTED, maxTicksLimit: 6 },
      border: { color: BORDER },
    },
  });

  // Shared dark, glow-free tooltip. `unit`/`xlabel`/`ylabel` tune the readout.
  const tooltip = (xlabel, ylabel, unit) => ({
    enabled: true,
    backgroundColor: '#161616',
    borderColor: BORDER,
    borderWidth: 1,
    titleColor: ACCENT,
    bodyColor: TEXT,
    titleFont: { family: "'Ubuntu', sans-serif", weight: '500' },
    bodyFont: { family: "'Ubuntu', sans-serif" },
    padding: 8,
    displayColors: false,
    caretSize: 0,
    callbacks: {
      title: () => '',
      label: (ctx) => {
        const x = ctx.parsed.x;
        const y = ctx.parsed.y;
        const xs = (Math.abs(x) < 100 ? x.toFixed(3) : x.toFixed(2));
        return ylabel + ' ' + y.toFixed(4) + '  ·  ' + xlabel + ' ' + xs + (unit ? ' ' + unit : '');
      },
    },
  });

  const baseOpts = (scales, tip) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    scales,
    plugins: {
      legend: { display: false },
      tooltip: tip || { enabled: false },
    },
  });

  const pts = (xs, ys) => xs.map((x, i) => ({ x, y: ys[i] }));

  // 1. Noisy light curve — scatter of measurements + outliers + dip points.
  const dipPts = LC.time
    .map((t, i) => ({ x: t, y: LC.noisy[i], dip: t > 18.2 && t < 21.8 }))
    .filter((p) => p.dip);

  const noisyChart = new Chart(document.getElementById('noisyChart'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          data: pts(LC.time, LC.noisy),
          backgroundColor: TEXT,
          pointRadius: 1.6,
        },
        {
          data: LC.outliers.map((y, i) => (y == null ? null : { x: LC.time[i], y })).filter(Boolean),
          backgroundColor: MUTED,
          pointRadius: 3,
          pointStyle: 'rectRot',
        },
        {
          data: dipPts,
          backgroundColor: ACCENT,
          pointRadius: 2.4,
        },
      ],
    },
    options: baseOpts(axis('Time (days)', 'Relative Flux', 0.94, 1.03), tooltip('Time', 'Flux', 'd')),
  });

  // 3. Denoised light curve — clean line.
  const denoisedChart = new Chart(document.getElementById('denoisedChart'), {
    type: 'line',
    data: {
      datasets: [
        {
          data: pts(LC.time, LC.denoised),
          borderColor: ACCENT,
          borderWidth: 1.6,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
        },
      ],
    },
    options: baseOpts(axis('Time (days)', 'Relative Flux', 0.94, 1.03), tooltip('Time', 'Flux', 'd')),
  });

  // 4. Transit probability over time + threshold line.
  const probChart = new Chart(document.getElementById('probChart'), {
    type: 'line',
    data: {
      datasets: [
        {
          data: pts(LC.time, LC.prob),
          borderColor: ACCENT,
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.3,
          fill: { target: 'origin', above: 'rgba(0,232,247,0.08)' },
        },
        {
          data: [{ x: 0, y: LC.threshold }, { x: 40, y: LC.threshold }],
          borderColor: MUTED,
          borderWidth: 1,
          borderDash: [5, 4],
          pointRadius: 0,
        },
      ],
    },
    options: baseOpts(axis('Time (days)', 'Transit Probability', 0, 1.05), tooltip('Time', 'Probability', 'd')),
  });

  // 5. Phase-folded light curve — data points + model fit.
  const phaseChart = new Chart(document.getElementById('phaseChart'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          data: pts(LC.phase, LC.folded),
          backgroundColor: MUTED,
          pointRadius: 1.6,
        },
        {
          type: 'line',
          data: pts(LC.phase, LC.fit),
          borderColor: ACCENT,
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.2,
        },
      ],
    },
    options: baseOpts(axis('Phase', 'Relative Flux', 0.94, 1.02), tooltip('Phase', 'Flux', '')),
  });

  // Training-data sparklines.
  document.querySelectorAll('.spark').forEach((cv) => {
    const { xs, ys } = LC.spark(cv.dataset.kind);
    new Chart(cv, {
      type: 'line',
      data: {
        datasets: [
          {
            data: pts(xs, ys),
            borderColor: ACCENT,
            borderWidth: 1.2,
            pointRadius: 0,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        scales: { x: { display: false }, y: { display: false, min: 0.93, max: 1.04 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  });

  // ---- Public API: let real-data analyses repopulate the main panels. ----
  function autoY(scale) { scale.min = undefined; scale.max = undefined; }

  window.Dashboard = {
    // `series` = { raw, denoised, probability, folded } as [{x,y}] arrays.
    applySeries: function (series) {
      if (series.raw) {
        noisyChart.data.datasets[0].data = series.raw;
        noisyChart.data.datasets[1].data = [];  // outliers
        noisyChart.data.datasets[2].data = [];  // highlighted dip
        autoY(noisyChart.options.scales.y);
        noisyChart.update();
      }
      if (series.denoised) {
        denoisedChart.data.datasets[0].data = series.denoised;
        autoY(denoisedChart.options.scales.y);
        denoisedChart.update();
      }
      if (series.probability && series.probability.length) {
        const xs = series.probability.map((p) => p.x);
        const x0 = Math.min.apply(null, xs);
        const x1 = Math.max.apply(null, xs);
        probChart.data.datasets[0].data = series.probability;
        probChart.data.datasets[1].data = [
          { x: x0, y: LC.threshold }, { x: x1, y: LC.threshold },
        ];
        probChart.update();
      }
      if (series.folded) {
        phaseChart.data.datasets[0].data = series.folded;
        phaseChart.data.datasets[0].backgroundColor = '#888888';
        phaseChart.data.datasets[1].data = [];  // no analytic fit for real data
        autoY(phaseChart.options.scales.y);
        phaseChart.update();
      }
    },
  };
  } // end start()

  // Chart.js may arrive via the fallback CDN (see index.html onerror), so wait
  // briefly for it rather than giving up immediately.
  if (typeof Chart !== 'undefined') {
    start();
  } else {
    var tries = 0;
    var iv = setInterval(function () {
      if (typeof Chart !== 'undefined') { clearInterval(iv); start(); }
      else if (++tries > 100) { clearInterval(iv); console.error('Chart.js failed to load — charts disabled.'); }
    }, 50);
  }
})();
