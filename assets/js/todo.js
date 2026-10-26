import { createCard, cardBody, el, escapeHtml, uid, animateIn, emitDataChanged, onDataChanged } from './ui.js';
import { getState, saveState } from './storage.js';

const RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

export function dueTimestamp(due) {
  if (!due) return null;
  const value = String(due);
  if (value.includes('T')) return new Date(value).getTime();
  return new Date(value + 'T00:00:00').getTime();
}

function dueValue(due) {
  if (!due) return '';
  const value = String(due);
  return value.includes('T') ? value.slice(0, 10) : value;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isOverdue(todo) {
  if (todo.done || !todo.due) return false;
  const t = dueTimestamp(todo.due);
  return t != null && t < startOfToday();
}

export function initTodo() {
  const card = createCard('todo', '待办', '✅');
  const body = cardBody(card);
  body.innerHTML = `
    <form class="todo-form">
      <input class="input todo-input" type="text" placeholder="添加待办，回车确认…" maxlength="200" required />
      <button class="btn" type="submit">添加</button>
    </form>
    <ul class="todo-list"></ul>
    <button class="todo-toggle" type="button">展开全部</button>`;
  const form = body.querySelector('.todo-form');
  const input = body.querySelector('.todo-input');
  const list = body.querySelector('.todo-list');
  const toggle = body.querySelector('.todo-toggle');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const id = uid();
    getState().todos.push({
      id, text, done: false, priority: 'medium', due: '',
      createdAt: Date.now(), reminded: false,
    });
    saveState();
    emitDataChanged();
    input.value = '';
    render();
    const item = list.querySelector(`.todo-item[data-id="${id}"]`);
    if (item) animateIn(item);
  });

  list.addEventListener('change', (e) => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    const todo = getState().todos.find(t => t.id === item.dataset.id);
    if (!todo) return;
    if (e.target.matches('.todo-check')) {
      todo.done = e.target.checked;
      if (todo.done) todo.reminded = true;
    } else if (e.target.matches('.todo-due-input')) {
      todo.due = e.target.value;
      todo.reminded = false;
    } else if (e.target.matches('.todo-prio')) {
      todo.priority = e.target.value;
    }
    saveState();
    emitDataChanged();
    render();
  });

  const COLLAPSE_LIMIT = 3;
  let todoExpanded = false;

  toggle.addEventListener('click', () => {
    todoExpanded = !todoExpanded;
    render();
  });

  list.addEventListener('click', (e) => {
    if (!e.target.matches('.todo-del')) return;
    const item = e.target.closest('.todo-item');
    const arr = getState().todos;
    const idx = arr.findIndex(t => t.id === item.dataset.id);
    if (idx > -1) { arr.splice(idx, 1); saveState(); emitDataChanged(); render(); }
  });

  function dueCompare(a, b) {
    const da = dueTimestamp(a);
    const db = dueTimestamp(b);
    if (da != null && db != null) return da - db;
    if (da != null) return -1;
    if (db != null) return 1;
    return 0;
  }

  function render() {
    const todos = [...getState().todos];
    todos.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const pa = RANK[a.priority] ?? 2;
      const pb = RANK[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      const due = dueCompare(a.due, b.due);
      if (due !== 0) return due;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    list.innerHTML = '';
    if (!todos.length) {
      list.innerHTML = '<li class="empty-hint">还没有待办，添加一条开始吧</li>';
      toggle.classList.remove('show-toggle');
      list.classList.remove('collapsed');
      return;
    }
    for (const t of todos) {
      const li = el(`
        <li class="todo-item prio-${t.priority}${t.done ? ' done' : ''}" data-id="${t.id}">
          <input class="todo-check" type="checkbox"${t.done ? ' checked' : ''} />
          <div class="todo-main">
            <span class="todo-text">${escapeHtml(t.text)}</span>
            <div class="todo-meta">
              <select class="todo-prio" title="优先级">
                <option value="urgent"${t.priority === 'urgent' ? ' selected' : ''}>最高</option>
                <option value="high"${t.priority === 'high' ? ' selected' : ''}>高</option>
                <option value="medium"${t.priority === 'medium' ? ' selected' : ''}>中</option>
                <option value="low"${t.priority === 'low' ? ' selected' : ''}>低</option>
              </select>
              <label class="todo-due" title="截止日期（可选）">
                <span class="todo-due-icon">📅</span>
                <input class="todo-due-input" type="date" value="${escapeHtml(dueValue(t.due))}" />
              </label>
              <button class="icon-btn todo-del" type="button" title="删除">✕</button>
            </div>
          </div>
        </li>`);
      if (isOverdue(t)) li.querySelector('.todo-due').classList.add('overdue');
      list.appendChild(li);
    }

    const count = todos.length;
    const collapsed = count > COLLAPSE_LIMIT && !todoExpanded;
    list.classList.toggle('collapsed', collapsed);
    toggle.classList.toggle('show-toggle', count > COLLAPSE_LIMIT);
    toggle.textContent = collapsed ? `展开全部 ${count} 条` : '收起';
  }

  onDataChanged(render);
  render();
  return card;
}