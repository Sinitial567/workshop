export function createCard(widgetId, title, icon) {
  const card = document.createElement('section');
  card.className = 'card';
  card.dataset.widget = widgetId;
  card.innerHTML = `
    <header class="card-head">
      <h2 class="card-title">${icon ? `${icon} ` : ''}${title}</h2>
    </header>
    <div class="card-body"></div>`;
  return card;
}

export function cardBody(card) {
  return card.querySelector('.card-body');
}

export function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function animateIn(element, opts = {}) {
  if (!element || !element.animate) return;
  const dx = opts.dx == null ? -16 : opts.dx;
  const duration = opts.duration || 180;
  element.animate(
    [
      { opacity: 0, transform: `translateX(${dx}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ],
    { duration, easing: 'ease-out' }
  );
}
export function emitDataChanged() {
  window.dispatchEvent(new CustomEvent('workbench:data-changed'));
}

export function onDataChanged(fn) {
  window.addEventListener('workbench:data-changed', fn);
}