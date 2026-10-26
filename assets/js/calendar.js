import { createCard, cardBody, el, escapeHtml, uid, emitDataChanged, onDataChanged } from './ui.js';
import { getState, saveState } from './storage.js';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function parseDate(ds) {
  const parts = ds.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let overlay = null;
let gridEl = null;
let titleEl = null;

export function initCalendar() {
  const card = createCard('calendar', '日历', '📅');
  const body = cardBody(card);
  body.innerHTML = `
    <div class="cal-head">
      <button class="icon-btn" data-prev type="button" title="上个月">‹</button>
      <div class="cal-title" data-title></div>
      <button class="icon-btn" data-next type="button" title="下个月">›</button>
      <button class="mini-btn" data-today type="button">今天</button>
    </div>
    <div class="cal-week">${WEEK_LABELS.map(w => `<span>${w}</span>`).join('')}</div>
    <div class="cal-grid" data-grid></div>`;

  titleEl = body.querySelector('[data-title]');
  gridEl = body.querySelector('[data-grid]');

  body.querySelector('[data-prev]').addEventListener('click', () => changeMonth(-1));
  body.querySelector('[data-next]').addEventListener('click', () => changeMonth(1));
  body.querySelector('[data-today]').addEventListener('click', () => {
    const n = new Date();
    viewYear = n.getFullYear();
    viewMonth = n.getMonth();
    render();
  });

  onDataChanged(refresh);
  render();

  const wideObserver = new ResizeObserver(entries => {
    const width = entries[0].target.getBoundingClientRect().width;
    card.classList.toggle('cal-wide', width >= 400);
  });
  wideObserver.observe(card);

  return card;
}

function refresh() {
  render();
  if (overlay && overlay.style.display === 'flex') renderDayList();
}

function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  else if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  render();
}

function todosOn(ds) {
  return getState().todos.filter(t => t.due === ds);
}

function render() {
  titleEl.textContent = `${viewYear}年${viewMonth + 1}月`;
  const first = new Date(viewYear, viewMonth, 1).getDay();
  const today = new Date();
  const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

  gridEl.innerHTML = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(viewYear, viewMonth, 1 - first + i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const dd = d.getDate();
    const ds = dateStr(y, m, dd);
    const outside = m !== viewMonth;
    const items = outside ? [] : todosOn(ds);
    const chipItems = items.slice(0, 2);
    const chipsHtml = chipItems.map(t =>
      `<span class="cal-chip prio-${t.priority}${t.done ? ' done' : ''}" title="${escapeHtml(t.text)}">${escapeHtml(t.text)}</span>`
    ).join('');
    const moreHtml = items.length > chipItems.length ? `<span class="cal-more">+${items.length - chipItems.length}</span>` : '';
    const cell = el(`
      <button class="cal-cell${outside ? ' outside' : ''}${ds === todayStr ? ' today' : ''}" type="button" data-date="${ds}">
        <span class="cal-date">${dd}</span>
        <span class="cal-dots">
          ${items.slice(0, 3).map(t => `<i class="dot prio-${t.priority}${t.done ? ' done' : ''}"></i>`).join('')}
          ${items.length > 3 ? `<i class="cal-more">+${items.length - 3}</i>` : ''}
        </span>
        <span class="cal-chips">${chipsHtml}${moreHtml}</span>
      </button>`);
    gridEl.appendChild(cell);
  }

  gridEl.querySelectorAll('.cal-cell').forEach(cell => {
    cell.addEventListener('click', () => openDay(cell.dataset.date));
  });
}

function openDay(ds) {
  buildOverlay();
  const d = parseDate(ds);
  overlay.dataset.date = ds;
  overlay.querySelector('[data-day-title]').textContent =
    `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_LABELS[d.getDay()]}`;
  renderDayList();
  overlay.style.display = 'flex';
  const input = overlay.querySelector('[data-remind-input]');
  input.value = '';
  setTimeout(() => input.focus(), 50);
}

function buildOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="modal cal-modal">
      <div class="modal-head">
        <h3 data-day-title></h3>
        <button class="icon-btn" data-close type="button" title="关闭">✕</button>
      </div>
      <ul class="cal-reminders" data-reminders></ul>
      <form class="cal-add" data-add-form>
        <input class="input" data-remind-input type="text" placeholder="添加提醒…" maxlength="120" required />
        <select class="input" data-remind-prio title="优先级">
          <option value="urgent">最高</option>
          <option value="high">高</option>
          <option value="medium" selected>中</option>
          <option value="low">低</option>
        </select>
        <button class="btn" type="submit">添加</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-close]').addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });

  const form = overlay.querySelector('[data-add-form]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ds = overlay.dataset.date;
    const text = form.querySelector('[data-remind-input]').value.trim();
    if (!text || !ds) return;
    const priority = form.querySelector('[data-remind-prio]').value;
    getState().todos.push({
      id: uid(), text, done: false, priority, due: ds,
      createdAt: Date.now(), reminded: false,
    });
    saveState();
    emitDataChanged();
    form.querySelector('[data-remind-input]').value = '';
    renderDayList();
  });

  const list = overlay.querySelector('[data-reminders]');
  list.addEventListener('change', (e) => {
    if (!e.target.matches('.cal-reminder-check')) return;
    const item = e.target.closest('.cal-reminder');
    const todo = getState().todos.find(t => t.id === item.dataset.id);
    if (!todo) return;
    todo.done = e.target.checked;
    if (todo.done) todo.reminded = true;
    saveState();
    emitDataChanged();
  });
  list.addEventListener('click', (e) => {
    if (!e.target.matches('[data-del]')) return;
    const item = e.target.closest('.cal-reminder');
    const arr = getState().todos;
    const idx = arr.findIndex(t => t.id === item.dataset.id);
    if (idx > -1) { arr.splice(idx, 1); saveState(); emitDataChanged(); }
  });
}

function renderDayList() {
  const ds = overlay.dataset.date;
  const list = overlay.querySelector('[data-reminders]');
  const items = todosOn(ds);
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<li class="cal-empty">这一天还没有提醒</li>';
    return;
  }
  for (const t of items) {
    const li = el(`
      <li class="cal-reminder prio-${t.priority}${t.done ? ' done' : ''}" data-id="${t.id}">
        <input class="todo-check cal-reminder-check" type="checkbox"${t.done ? ' checked' : ''} />
        <span class="cal-reminder-text">${escapeHtml(t.text)}</span>
        <button class="icon-btn" data-del type="button" title="删除">✕</button>
      </li>`);
    list.appendChild(li);
  }
}

function closeOverlay() {
  if (overlay) overlay.style.display = 'none';
}
