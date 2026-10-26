import { createCard, cardBody } from './ui.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function greeting(hour) {
  if (hour < 5) return '夜深了，早点休息 🌙';
  if (hour < 9) return '早上好，新的一天 ☀️';
  if (hour < 12) return '上午好，加油 💪';
  if (hour < 14) return '中午好，记得休息 🍵';
  if (hour < 18) return '下午好，保持专注 🚀';
  if (hour < 23) return '晚上好，放松一下 🌆';
  return '夜深了，早点休息 🌙';
}

export function initClock() {
  const card = createCard('clock', '时钟', '🕒');
  const body = cardBody(card);
  body.innerHTML = `
    <div class="clock">
      <div class="clock-time">--:--:--</div>
      <div class="clock-date">--</div>
      <div class="clock-greeting">--</div>
    </div>`;
  const timeEl = body.querySelector('.clock-time');
  const dateEl = body.querySelector('.clock-date');
  const greetEl = body.querySelector('.clock-greeting');
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    const now = new Date();
    timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    dateEl.textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 星期${WEEK[now.getDay()]}`;
    greetEl.textContent = greeting(now.getHours());
  }
  tick();
  setInterval(tick, 1000);
  return card;
}
