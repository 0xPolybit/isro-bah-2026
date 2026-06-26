/*
 * Full-screen loading overlay. The overlay (and centred icon) fade in via CSS;
 * this fades it out once the page is ready, after a short minimum so the
 * animation is always visible, with a safety timeout so it can never get stuck.
 */
(function () {
  var loader = document.getElementById('loader');
  if (!loader) return;

  var start = Date.now();
  var MIN_MS = 700;   // keep the loader up at least this long (let it fade in)
  var MAX_MS = 5000;  // hard cap so a slow/blocked resource can't trap the user
  var done = false;

  function hide() {
    if (done) return;
    done = true;
    loader.classList.add('hidden');
    // Remove from the DOM after the fade-out transition completes.
    setTimeout(function () {
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    }, 600);
  }

  function whenReady() {
    var wait = Math.max(0, MIN_MS - (Date.now() - start));
    setTimeout(hide, wait);
  }

  if (document.readyState === 'complete') whenReady();
  else window.addEventListener('load', whenReady);

  setTimeout(hide, MAX_MS);
})();
