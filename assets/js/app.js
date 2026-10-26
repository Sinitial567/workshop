import { loadState, getState, saveState, resetState, exportJSON, importJSON } from './storage.js';
import { initGrid } from './grid.js';
import { initClock } from './clock.js';
import { initWeather, openCityPicker, refreshWeather } from './weather.js';
import { initTodo, dueTimestamp } from './todo.js';
import { initNotes } from './notes.js';
import { initBookmarks } from './bookmarks.js';
import { initCalendar } from './calendar.js';
import { initPomodoro, applySettings } from './pomodoro.js';
import { alertUser, primeAudio, requestNotifyPermission } from './notify.js';
import { initSync, enableSync, disableSync, pushNow, pullNow, getSyncCode, isSyncEnabled } from './sync.js';

const factories = {
  clock: initClock,
  weather: initWeather,
  todo: initTodo,
  calendar: initCalendar,
  pomodoro: initPomodoro,
  notes: initNotes,
  bookmarks: initBookmarks,
};

const gridEl = document.getElementById('grid');
const btnSettings = document.getElementById('btn-settings');
const btnWallpaper = document.getElementById('btn-wallpaper');

function applyTheme() {
  const s = getState();
  document.body.dataset.theme = s.theme;
  applyBackground();
}

function applyBackground() {
  const s = getState();
  if (s.background) {
    const overlay = s.theme === 'light'
      ? 'linear-gradient(rgba(255,255,255,0.62), rgba(255,255,255,0.68))'
      : 'linear-gradient(rgba(8,10,14,0.5), rgba(8,10,14,0.55))';
    document.body.style.backgroundImage = `${overlay}, url(${s.background})`;
  } else {
    document.body.style.backgroundImage = '';
  }
}

function renderGrid() {
  const s = getState();
  gridEl.innerHTML = '';
  const order = (s.layout.order || []).filter(id => factories[id]);
  const known = Object.keys(factories);
  const ids = new Set(order);
  const all = [...order, ...known.filter(id => !ids.has(id))];
  for (const id of all) {
    const card = factories[id]();
    if (s.layout.hidden && s.layout.hidden[id]) card.style.display = 'none';
    gridEl.appendChild(card);
  }
}

function checkDueReminders() {
  const s = getState();
  if (!s.remindersEnabled) return;
  const now = Date.now();
  let changed = false;
  for (const todo of s.todos) {
    if (!todo.done && todo.due && dueTimestamp(todo.due) != null && dueTimestamp(todo.due) <= now && !todo.reminded) {
      todo.reminded = true;
      changed = true;
      alertUser('待办到期', todo.text);
    }
  }
  if (changed) saveState();
}

function readWallpaper(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1920;
        const scale = Math.min(1, max / img.width, max / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function initSettings() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>设置</h3>
        <button class="icon-btn" data-close type="button" title="关闭">✕</button>
      </div>
      <div class="setting-row">
        <label for="set-theme">主题</label>
        <select id="set-theme" class="input">
          <option value="dark">深色</option>
          <option value="light">浅色</option>
        </select>
      </div>
      <div class="setting-row">
        <label>背景壁纸</label>
        <div class="setting-actions">
          <span class="setting-value" data-wallpaper-value>未设置</span>
          <button class="btn" data-wallpaper type="button">选择图片</button>
          <button class="btn" data-wallpaper-clear type="button">清除</button>
          <input type="file" data-wallpaper-file accept="image/*" hidden />
        </div>
      </div>
      <div class="setting-row">
        <label>天气城市</label>
        <div class="setting-actions">
          <span class="setting-value" data-city-value>未设置</span>
          <button class="btn" data-city-change type="button">更改</button>
        </div>
      </div>
      <div class="setting-row">
        <label>番茄钟（分钟）</label>
        <div class="setting-actions">
          <input type="number" class="input input-num" data-work min="1" max="180" />
          <span>专注</span>
          <input type="number" class="input input-num" data-break min="1" max="60" />
          <span>休息</span>
        </div>
      </div>
      <div class="setting-row">
        <label for="set-remind">待办到期提醒</label>
        <input type="checkbox" id="set-remind" data-remind />
      </div>
      <div class="setting-row">
        <label>云同步</label>
        <div class="setting-actions sync-actions">
          <input type="text" class="input sync-input" data-sync-code placeholder="输入同步码" autocomplete="off" />
          <button class="btn" data-sync-gen type="button">生成</button>
          <button class="btn" data-sync-enable type="button">启用</button>
          <button class="btn" data-sync-disable type="button">停用</button>
        </div>
      </div>
      <div class="setting-row">
        <label></label>
        <div class="setting-actions">
          <button class="btn" data-sync-upload type="button">上传到云端</button>
          <button class="btn" data-sync-download type="button">从云端载入</button>
          <span class="setting-value" data-sync-status></span>
        </div>
      </div>
      <div class="setting-row">
        <label>数据备份</label>
        <div class="setting-actions">
          <button class="btn" data-export type="button">导出</button>
          <button class="btn" data-import type="button">导入</button>
          <input type="file" data-import-file accept="application/json,.json" hidden />
        </div>
      </div>
      <div class="setting-row">
        <label>恢复默认</label>
        <button class="btn btn-danger" data-reset type="button">恢复默认设置</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const themeSel = overlay.querySelector('#set-theme');
  const remindBox = overlay.querySelector('[data-remind]');
  const workInput = overlay.querySelector('[data-work]');
  const breakInput = overlay.querySelector('[data-break]');
  const cityValue = overlay.querySelector('[data-city-value]');
  const wallpaperValue = overlay.querySelector('[data-wallpaper-value]');
  const wallpaperFile = overlay.querySelector('[data-wallpaper-file]');
  const importFile = overlay.querySelector('[data-import-file]');
  const syncCodeInput = overlay.querySelector('[data-sync-code]');
  const syncStatus = overlay.querySelector('[data-sync-status]');

  function syncFields() {
    const s = getState();
    themeSel.value = s.theme;
    remindBox.checked = !!s.remindersEnabled;
    workInput.value = s.pomodoro.work;
    breakInput.value = s.pomodoro.break;
    cityValue.textContent = s.city ? s.city.name : '未设置';
    wallpaperValue.textContent = s.background ? '已设置' : '未设置';
    syncCodeInput.value = getSyncCode();
    syncStatus.textContent = isSyncEnabled() ? '已启用' : '未启用';
  }

  function open() { syncFields(); overlay.style.display = 'flex'; }
  function close() { overlay.style.display = 'none'; }

  btnSettings.addEventListener('click', open);
  overlay.querySelector('[data-close]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  themeSel.addEventListener('change', () => {
    getState().theme = themeSel.value;
    saveState();
    applyTheme();
  });

  wallpaperFile.addEventListener('change', async () => {
    const file = wallpaperFile.files && wallpaperFile.files[0];
    wallpaperFile.value = '';
    if (!file) return;
    try {
      const dataUrl = await readWallpaper(file);
      getState().background = dataUrl;
      saveState();
      applyBackground();
      wallpaperValue.textContent = '已设置';
    } catch (err) {
      alert('壁纸设置失败：' + (err.message || err));
    }
  });

  overlay.querySelector('[data-wallpaper]').addEventListener('click', () => wallpaperFile.click());
  if (btnWallpaper) btnWallpaper.addEventListener('click', () => wallpaperFile.click());
  overlay.querySelector('[data-wallpaper-clear]').addEventListener('click', () => {
    getState().background = '';
    saveState();
    applyBackground();
    wallpaperValue.textContent = '未设置';
  });

  overlay.querySelector('[data-city-change]').addEventListener('click', () => {
    openCityPicker(() => { refreshWeather(); syncFields(); });
  });

  workInput.addEventListener('change', () => {
    const v = clampInt(workInput.value, 1, 180, 25);
    workInput.value = v;
    getState().pomodoro.work = v;
    saveState();
    applySettings();
  });
  breakInput.addEventListener('change', () => {
    const v = clampInt(breakInput.value, 1, 60, 5);
    breakInput.value = v;
    getState().pomodoro.break = v;
    saveState();
    applySettings();
  });

  remindBox.addEventListener('change', () => {
    getState().remindersEnabled = remindBox.checked;
    saveState();
    if (remindBox.checked) requestNotifyPermission();
  });

  overlay.querySelector('[data-export]').addEventListener('click', exportJSON);
  overlay.querySelector('[data-import]').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files && importFile.files[0];
    importFile.value = '';
    if (!file) return;
    try {
      await importJSON(file);
      location.reload();
    } catch (err) {
      alert('导入失败：' + (err.message || err));
    }
  });

  overlay.querySelector('[data-reset]').addEventListener('click', () => {
    if (confirm('确定要恢复默认设置吗？所有数据都会被清空。')) {
      resetState();
      location.reload();
    }
  });

  overlay.querySelector('[data-sync-gen]').addEventListener('click', () => {
    syncCodeInput.value = randomSyncCode();
  });

  overlay.querySelector('[data-sync-enable]').addEventListener('click', async () => {
    const code = syncCodeInput.value.trim();
    if (!code) { alert('请先输入同步码'); return; }
    syncStatus.textContent = '正在连接…';
    try {
      const action = await enableSync(code);
      if (action === 'pulled') {
        location.reload();
      } else {
        syncStatus.textContent = '已启用，并已上传到云端';
      }
    } catch (err) {
      syncStatus.textContent = '失败';
      alert(err.message || err);
    }
  });

  overlay.querySelector('[data-sync-disable]').addEventListener('click', () => {
    disableSync();
    syncStatus.textContent = '已停用';
  });

  overlay.querySelector('[data-sync-upload]').addEventListener('click', async () => {
    if (!isSyncEnabled()) { alert('请先启用云同步'); return; }
    syncStatus.textContent = '正在上传…';
    try {
      await pushNow();
      syncStatus.textContent = '已上传到云端';
    } catch (err) {
      syncStatus.textContent = '失败';
      alert(err.message || err);
    }
  });

  overlay.querySelector('[data-sync-download]').addEventListener('click', async () => {
    if (!isSyncEnabled()) { alert('请先启用云同步'); return; }
    syncStatus.textContent = '正在载入…';
    try {
      await pullNow();
      location.reload();
    } catch (err) {
      syncStatus.textContent = '失败';
      alert(err.message || err);
    }
  });
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function randomSyncCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function bootstrap() {
  loadState();
  try { await initSync(); } catch (err) { console.warn(err); }
  applyTheme();
  renderGrid();
  initGrid(gridEl);
  initSettings();
  checkDueReminders();
  setInterval(checkDueReminders, 30000);

  window.addEventListener('beforeunload', saveState);

  const unlock = () => { primeAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  if (!getState().city) {
    setTimeout(() => openCityPicker(refreshWeather), 600);
  }
}

bootstrap();

