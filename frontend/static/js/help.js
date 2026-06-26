/*
 * Per-section controls. Every card header gets two buttons:
 *   - a fullscreen/expand button (left) that moves the live card into a large
 *     dialog so its charts/content can be viewed in detail, and
 *   - a "?" help button (right) that opens a centred modal describing the data
 *     the card displays (from its data-help attribute).
 *
 * The fullscreen view re-parents the actual card element (rather than cloning
 * it) so the existing Chart.js instances keep rendering; on close it is moved
 * back to its original position.
 */
(function () {
  // ---- Help modal ----
  const overlay = document.getElementById('helpModal');
  const titleEl = document.getElementById('helpModalTitle');
  const bodyEl = document.getElementById('helpModalBody');
  const closeBtn = document.getElementById('helpModalClose');

  // The button that opened a dialog, so focus can return to it on close (a11y).
  let returnFocus = null;

  function openModal(title, body) {
    titleEl.textContent = title;
    bodyEl.textContent = body;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    if (returnFocus) { returnFocus.focus(); returnFocus = null; }
  }

  // ---- Fullscreen section dialog ----
  const fsOverlay = document.getElementById('fsOverlay');
  const fsStage = document.getElementById('fsStage');
  const fsDetail = document.getElementById('fsDetail');
  const fsTitle = document.getElementById('fsTitle');
  const fsDesc = document.getElementById('fsDesc');
  const fsClose = document.getElementById('fsClose');

  let activeCard = null;
  let placeholder = null;

  function openFullscreen(card, title) {
    if (activeCard) return;
    activeCard = card;

    // Remember the card's home position with a placeholder node.
    placeholder = document.createComment('fs-placeholder');
    card.parentNode.insertBefore(placeholder, card);

    fsTitle.textContent = title;
    fsDesc.textContent = card.getAttribute('data-help') || '';
    fsStage.appendChild(card);
    card.classList.add('in-fullscreen');

    // Populate the extended detail panel for this section, if any.
    const detail = (window.SECTION_DETAILS || {})[card.dataset.section];
    fsDetail.innerHTML = detail || '';
    fsDetail.hidden = !detail;
    fsDetail.scrollTop = 0;

    fsOverlay.classList.add('open');
    fsOverlay.setAttribute('aria-hidden', 'false');
    fsClose.focus();

    // Nudge any responsive charts to recompute their size in the larger box.
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }

  function closeFullscreen() {
    if (!activeCard) return;
    activeCard.classList.remove('in-fullscreen');
    placeholder.parentNode.insertBefore(activeCard, placeholder);
    placeholder.remove();

    fsOverlay.classList.remove('open');
    fsOverlay.setAttribute('aria-hidden', 'true');
    fsDetail.innerHTML = '';  // drop detail content until the next open

    activeCard = null;
    placeholder = null;
    if (returnFocus) { returnFocus.focus(); returnFocus = null; }
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }

  // Expand icon: four corner brackets (uses currentColor so hover state works).
  const FS_ICON =
    '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="square">' +
    '<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>';

  // ---- Inject both buttons into every card with a description ----
  document.querySelectorAll('.card[data-help]').forEach(function (card) {
    const head = card.querySelector('.card-head');
    if (!head) return;

    const heading = head.querySelector('h2');
    const title = heading
      ? heading.textContent.replace(/^\s*\d+\.\s*/, '').trim()
      : 'Details';

    const fsBtn = document.createElement('button');
    fsBtn.className = 'fs-btn';
    fsBtn.type = 'button';
    fsBtn.innerHTML = FS_ICON;
    fsBtn.setAttribute('aria-label', 'Expand: ' + title);
    fsBtn.addEventListener('click', function () { returnFocus = fsBtn; openFullscreen(card, title); });
    head.appendChild(fsBtn);

    const helpBtn = document.createElement('button');
    helpBtn.className = 'help-btn';
    helpBtn.type = 'button';
    helpBtn.textContent = '?';
    helpBtn.setAttribute('aria-label', 'What is this? ' + title);
    helpBtn.addEventListener('click', function () {
      returnFocus = helpBtn;
      openModal(title, card.getAttribute('data-help'));
    });
    head.appendChild(helpBtn);
  });

  // ---- Wiring ----
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  fsClose.addEventListener('click', closeFullscreen);
  fsOverlay.addEventListener('click', function (e) {
    if (e.target === fsOverlay) closeFullscreen();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (overlay.classList.contains('open')) closeModal();
    else if (fsOverlay.classList.contains('open')) closeFullscreen();
  });
})();
