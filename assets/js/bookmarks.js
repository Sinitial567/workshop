import { createCard, cardBody, el, escapeHtml, uid, animateIn } from './ui.js';
import { getState, saveState } from './storage.js';

function hostOf(url) {
  try { return new URL(url).hostname; } catch (err) { return ''; }
}

function favicon(url) {
  const host = hostOf(url);
  return host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '';
}

function normalizeUrl(input) {
  const value = input.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return 'https://' + value;
}

export function initBookmarks() {
  const card = createCard('bookmarks', '书签', '🔖');
  const body = cardBody(card);
  body.innerHTML = `
    <form class="bookmark-form">
      <input class="input" data-name type="text" placeholder="名称" maxlength="60" required />
      <input class="input" data-url type="text" placeholder="网址，如 github.com" required />
      <input class="input" data-group type="text" placeholder="分组（可空）" maxlength="30" list="group-list" />
      <button class="btn" type="submit">添加</button>
      <datalist id="group-list"></datalist>
    </form>
    <div class="bookmark-groups"></div>`;
  const form = body.querySelector('.bookmark-form');
  const groupsEl = body.querySelector('.bookmark-groups');
  const datalist = body.querySelector('#group-list');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('[data-name]').value.trim();
    const url = normalizeUrl(form.querySelector('[data-url]').value);
    const group = form.querySelector('[data-group]').value.trim() || '默认';
    if (!name || !url) return;
    const id = uid();
    getState().bookmarks.push({ id, name, url, group, createdAt: Date.now() });
    saveState();
    form.reset();
    render();
    const item = groupsEl.querySelector(`.bookmark-item[data-id="${id}"]`);
    if (item) animateIn(item);
  });

  groupsEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-del]')) return;
    const item = e.target.closest('.bookmark-item');
    if (!item) return;
    const arr = getState().bookmarks;
    const idx = arr.findIndex(b => b.id === item.dataset.id);
    if (idx > -1) { arr.splice(idx, 1); saveState(); render(); }
  });

  function render() {
    const bookmarks = getState().bookmarks;
    const groups = {};
    for (const b of bookmarks) {
      const key = b.group || '默认';
      (groups[key] = groups[key] || []).push(b);
    }
    datalist.innerHTML = '';
    for (const key of Object.keys(groups)) {
      const opt = document.createElement('option');
      opt.value = key;
      datalist.appendChild(opt);
    }
    groupsEl.innerHTML = '';
    if (!bookmarks.length) {
      groupsEl.innerHTML = '<div class="empty-hint">添加常用网站，一键直达</div>';
      return;
    }
    for (const [group, items] of Object.entries(groups)) {
      const section = el(`<div class="bookmark-group"><h4 class="bookmark-group-title">${escapeHtml(group)}</h4></div>`);
      for (const b of items) {
        const item = el(`
          <div class="bookmark-item" data-id="${b.id}">
            <img src="${escapeHtml(favicon(b.url))}" alt="" loading="lazy" />
            <a class="bookmark-link" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.name)}</a>
            <button class="icon-btn" data-del type="button" title="删除">✕</button>
          </div>`);
        const img = item.querySelector('img');
        img.addEventListener('error', () => {
          const span = document.createElement('span');
          span.className = 'bookmark-avatar';
          span.textContent = (b.name || '?').charAt(0).toUpperCase();
          img.replaceWith(span);
        });
        section.appendChild(item);
      }
      groupsEl.appendChild(section);
    }
  }

  render();
  return card;
}