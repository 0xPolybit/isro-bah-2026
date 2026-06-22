/*
 * Per-section help. Injects a "?" button into every card header and opens a
 * centred modal describing the data that card displays (from its data-help).
 */
(function () {
  const overlay = document.getElementById('helpModal');
  const titleEl = document.getElementById('helpModalTitle');
  const bodyEl = document.getElementById('helpModalBody');
  const closeBtn = document.getElementById('helpModalClose');

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
  }

  document.querySelectorAll('.card[data-help]').forEach(function (card) {
    const head = card.querySelector('.card-head');
    if (!head) return;

    const heading = head.querySelector('h2');
    const title = heading ? heading.textContent.replace(/^\s*\d+\.\s*/, '').trim() : 'Details';

    const btn = document.createElement('button');
    btn.className = 'help-btn';
    btn.type = 'button';
    btn.textContent = '?';
    btn.setAttribute('aria-label', 'What is this? ' + title);
    btn.addEventListener('click', function () {
      openModal(title, card.getAttribute('data-help'));
    });
    head.appendChild(btn);
  });

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });
})();
