/*
 * Synthetic light-curve generation.
 * Front-end only: this fabricates plausible-looking data so the dashboard
 * has something to render. No real detection is performed here.
 */
(function () {
  // Deterministic PRNG so the demo looks the same on every load.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(42);
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // A boxy transit dip centred on `center`, fractional depth `depth`.
  function transit(t, center, halfWidth, depth) {
    const d = Math.abs(t - center);
    if (d > halfWidth) return 0;
    // Smoothed ingress/egress shoulders.
    const edge = halfWidth * 0.35;
    if (d < halfWidth - edge) return -depth;
    return -depth * (halfWidth - d) / edge;
  }

  const N = 200;
  const T_MAX = 40;
  const CENTER = 20;
  const HALF = 1.6;
  const DEPTH = 0.045;

  const time = [];
  const noisy = [];
  const clean = [];
  const denoised = [];
  const outliers = [];
  const prob = [];

  let smooth = 1;
  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1)) * T_MAX;
    const base = 1 + transit(t, CENTER, HALF, DEPTH);
    const value = base + gauss() * 0.006;

    time.push(t);
    clean.push(base);

    // Occasional outliers far from the trend.
    const isOutlier = rand() < 0.03;
    const point = isOutlier ? value + (rand() - 0.5) * 0.05 : value;
    noisy.push(point);
    outliers.push(isOutlier ? point : null);

    // Exponential-moving-average "denoiser".
    smooth = smooth * 0.7 + base * 0.3 + gauss() * 0.0015;
    denoised.push(smooth);

    // Transit probability: a peak around the dip, low elsewhere.
    const p = Math.exp(-Math.pow((t - CENTER + 0.4) / 1.1, 2)) * 0.98;
    prob.push(Math.min(0.99, p + rand() * 0.02));
  }

  // Phase-folded curve (folded on the recovered period).
  const phase = [];
  const folded = [];
  const fit = [];
  for (let i = 0; i < 120; i++) {
    const ph = -0.07 + (i / 119) * 0.14;
    const model = 1 + transit(ph, 0, 0.025, DEPTH);
    phase.push(ph);
    fit.push(model);
    folded.push(model + gauss() * 0.004);
  }

  // Small sparkline samples for the "training data examples" panel.
  function spark(kind) {
    const xs = [], ys = [];
    for (let i = 0; i < 80; i++) {
      const t = i / 79;
      let y = 1;
      if (kind === 'transit') y += transit(t, 0.5, 0.08, 0.04);
      else if (kind === 'eclipse') {
        y += transit(t, 0.35, 0.05, 0.05) + transit(t, 0.8, 0.05, 0.025);
      } else if (kind === 'spot') {
        y += Math.sin(t * Math.PI * 3) * 0.02;
      } else if (kind === 'blend') {
        y += transit(t, 0.5, 0.07, 0.018) + Math.sin(t * Math.PI * 5) * 0.008;
      }
      xs.push(t);
      ys.push(y + gauss() * 0.004);
    }
    return { xs, ys };
  }

  window.LC = {
    time, noisy, denoised, outliers, prob,
    phase, folded, fit,
    threshold: 0.5,
    spark,
  };
})();
