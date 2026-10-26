const STORAGE_KEY = 'workbench-state-v1';

const WIDGET_IDS = ['clock', 'weather', 'todo', 'calendar', 'pomodoro', 'notes', 'bookmarks'];

function defaultState() {
  return {
    version: 1,
    theme: 'dark',
    background: '',
    city: null,
    remindersEnabled: true,
    layout: { order: [...WIDGET_IDS], hidden: {} },
    todos: [],
    notes: [],
    bookmarks: [],
    pomodoro: { work: 25, break: 5, running: false, mode: 'work', remaining: 25 * 60, endsAt: null },
    weather: { fetchedAt: 0, data: null },
  };
}

let state = defaultState();

export function getState() { return state; }

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { saveState(); return; }
    const parsed = JSON.parse(raw);
    mergeIntoState(parsed);
  } catch (err) {
    console.warn('读取本地数据失败，已重置为默认值', err);
    state = defaultState();
    saveState();
  }
}

export function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (err) { console.error('保存数据失败', err); }
  try { window.dispatchEvent(new CustomEvent('workbench:state-saved')); } catch (err) { /* noop */ }
}

export function resetState() {
  state = defaultState();
  saveState();
}

export function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  a.href = url;
  a.download = `工作台备份-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('备份文件格式无效');
        mergeIntoState(parsed);
        saveState();
        resolve();
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

export function replaceState(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('云端数据格式无效');
  mergeIntoState(parsed);
  saveState();
}

function mergeIntoState(parsed) {
  const base = defaultState();
  state = {
    ...base,
    ...parsed,
    layout: { ...base.layout, ...(parsed.layout || {}) },
    pomodoro: { ...base.pomodoro, ...(parsed.pomodoro || {}) },
    weather: { ...base.weather, ...(parsed.weather || {}) },
  };
  if (!Array.isArray(state.layout.order)) state.layout.order = base.layout.order;
  if (typeof state.layout.hidden !== 'object' || !state.layout.hidden) state.layout.hidden = {};
  if (!Array.isArray(state.todos)) state.todos = [];
  if (!Array.isArray(state.notes)) state.notes = [];
  if (!Array.isArray(state.bookmarks)) state.bookmarks = [];
}
