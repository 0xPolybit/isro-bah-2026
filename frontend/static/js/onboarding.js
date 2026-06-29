/*
 * First-visit onboarding + an always-available "Analyze Your Data" entry point.
 * A new visitor lands on a demo dashboard with no obvious place to act, so we:
 *   - show a one-time welcome modal explaining the demo and the three input modes;
 *   - provide a top-bar CTA that scrolls to and highlights the Analyze panel.
 */
(function () {
  const KEY = 'tessnet_welcomed_v1';
  const $ = (id) => document.getElementById(id);

  const analyze = $('analyze');
  const cta = $('analyzeCta');
  const wm = $('welcomeModal');
  const wClose = $('welcomeClose');
  const wGo = $('welcomeGo');

  // Scroll the Analyze panel into view and pulse it to draw the eye.
  function highlightAnalyze() {
    if (!analyze) return;
    analyze.scrollIntoView({ behavior: 'smooth', block: 'center' });
    analyze.classList.remove('highlight');
    void analyze.offsetWidth;            // restart the CSS animation
    analyze.classList.add('highlight');
    const firstTab = analyze.querySelector('.analyze-tab');
    if (firstTab) firstTab.focus();
  }
  if (analyze) {
    analyze.addEventListener('animationend', function () {
      analyze.classList.remove('highlight');
    });
  }
  if (cta) cta.addEventListener('click', highlightAnalyze);

  // ---- One-time welcome modal ----
  if (!wm) return;

  function openWelcome() {
    wm.classList.add('open');
    wm.setAttribute('aria-hidden', 'false');
    if (wGo) wGo.focus();
  }
  function closeWelcome() {
    wm.classList.remove('open');
    wm.setAttribute('aria-hidden', 'true');
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
  }

  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch (e) { seen = false; }
  if (!seen) {
    // Wait for the loading splash to clear before greeting the user.
    setTimeout(openWelcome, 1300);
  }

  if (wClose) wClose.addEventListener('click', closeWelcome);
  if (wGo) wGo.addEventListener('click', function () {
    closeWelcome();
    setTimeout(highlightAnalyze, 250);
  });
  wm.addEventListener('click', function (e) { if (e.target === wm) closeWelcome(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wm.classList.contains('open')) closeWelcome();
  });
})();
