/*
 * Chart rendering. All charts share the greyscale + electric-blue theme.
 * No glow effects; subtle, short animations only.
 */
(function () {
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

  const baseOpts = (scales) => ({
    responsive: true,
    maintainAspectRatio: false,
    scales,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  });

  const pts = (xs, ys) => xs.map((x, i) => ({ x, y: ys[i] }));

  // 1. Noisy light curve — scatter of measurements + outliers + dip points.
  const dipPts = LC.time
    .map((t, i) => ({ x: t, y: LC.noisy[i], dip: t > 18.2 && t < 21.8 }))
    .filter((p) => p.dip);

  new Chart(document.getElementById('noisyChart'), {
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
    options: baseOpts(axis('Time (days)', 'Relative Flux', 0.94, 1.03)),
  });

  // 3. Denoised light curve — clean line.
  new Chart(document.getElementById('denoisedChart'), {
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
    options: baseOpts(axis('Time (days)', 'Relative Flux', 0.94, 1.03)),
  });

  // 4. Transit probability over time + threshold line.
  new Chart(document.getElementById('probChart'), {
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
    options: baseOpts(axis('Time (days)', 'Transit Probability', 0, 1.05)),
  });

  // 5. Phase-folded light curve — data points + model fit.
  new Chart(document.getElementById('phaseChart'), {
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
    options: baseOpts(axis('Phase', 'Relative Flux', 0.94, 1.02)),
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
})();
