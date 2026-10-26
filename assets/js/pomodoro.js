import { createCard, cardBody } from './ui.js';
import { getState, saveState } from './storage.js';
import { alertUser, requestNotifyPermission } from './notify.js';

let card = null;
let timerId = null;

export function initPomodoro() {
  card = createCard('pomodoro', '番茄钟', '🍅');
  const body = cardBody(card);
  body.innerHTML = `
    <div class="pomodoro">
      <div class="pomodoro-mode">🍅 专注</div>
      <div class="pomodoro-time">25:00</div>
      <div class="pomodoro-controls">
        <button class="btn" data-start type="button">开始</button>
        <button class="btn" data-pause type="button">暂停</button>
        <button class="btn" data-reset type="button">重置</button>
      </div>
    </div>`;
  body.querySelector('[data-start]').addEventListener('click', start);
  body.querySelector('[data-pause]').addEventListener('click', pause);
  body.querySelector('[data-reset]').addEventListener('click', reset);
  syncFromState();
  tick();
  timerId = setInterval(tick, 250);
  return card;
}

function minutes(mode) {
  const p = getState().pomodoro;
  return mode === 'work' ? p.work : p.break;
}

function syncFromState() {
  const p = getState().pomodoro;
  if (p.remaining == null) p.remaining = minutes(p.mode) * 60;
}

function currentRemaining() {
  const p = getState().pomodoro;
  if (p.running && p.endsAt) {
    return Math.max(0, Math.round((p.endsAt - Date.now()) / 1000));
  }
  return p.remaining ?? minutes(p.mode) * 60;
}

function start() {
  requestNotifyPermission();
  const p = getState().pomodoro;
  if (p.running) return;
  p.running = true;
  p.remaining = currentRemaining();
  p.endsAt = Date.now() + p.remaining * 1000;
  saveState();
  render();
}

function pause() {
  const p = getState().pomodoro;
  if (!p.running) return;
  p.remaining = currentRemaining();
  p.running = false;
  p.endsAt = null;
  saveState();
  render();
}

function reset() {
  const p = getState().pomodoro;
  p.running = false;
  p.endsAt = null;
  p.mode = 'work';
  p.remaining = minutes('work') * 60;
  saveState();
  render();
}

function finish() {
  const p = getState().pomodoro;
  const finishedMode = p.mode;
  p.running = false;
  p.endsAt = null;
  if (finishedMode === 'work') {
    p.mode = 'break';
    p.remaining = minutes('break') * 60;
    alertUser('专注结束', '干得漂亮！休息一下吧 ☕');
    p.running = true;
    p.endsAt = Date.now() + p.remaining * 1000;
  } else {
    p.mode = 'work';
    p.remaining = minutes('work') * 60;
    alertUser('休息结束', '开始新一轮专注吧 💪');
  }
  saveState();
  render();
}

function tick() {
  const p = getState().pomodoro;
  if (p.running && p.endsAt && Date.now() >= p.endsAt) {
    finish();
    return;
  }
  render();
}

function render() {
  if (!card) return;
  const p = getState().pomodoro;
  const secs = currentRemaining();
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const pad = n => String(n).padStart(2, '0');
  card.querySelector('.pomodoro-time').textContent = `${pad(m)}:${pad(s)}`;
  card.querySelector('.pomodoro-mode').textContent = p.mode === 'work' ? '🍅 专注' : '☕ 休息';
}

export function applySettings() {
  const p = getState().pomodoro;
  if (!p.running) {
    p.remaining = minutes(p.mode) * 60;
    saveState();
  }
  render();
}
