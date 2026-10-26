import { createCard, cardBody } from './ui.js';
import { getState, saveState } from './storage.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

const CODES = {
  0: ['☀️', '晴'], 1: ['🌤️', '大部晴朗'], 2: ['⛅', '多云'], 3: ['☁️', '阴'],
  45: ['🌫️', '雾'], 48: ['🌫️', '雾凇'],
  51: ['🌦️', '小毛毛雨'], 53: ['🌦️', '毛毛雨'], 55: ['🌧️', '大毛毛雨'],
  56: ['🌧️', '冻毛毛雨'], 57: ['🌧️', '冻毛毛雨'],
  61: ['🌦️', '小雨'], 63: ['🌧️', '中雨'], 65: ['🌧️', '大雨'],
  66: ['🌧️', '冻雨'], 67: ['🌧️', '冻雨'],
  71: ['🌨️', '小雪'], 73: ['🌨️', '中雪'], 75: ['❄️', '大雪'], 77: ['🌨️', '雪粒'],
  80: ['🌦️', '阵雨'], 81: ['🌧️', '阵雨'], 82: ['⛈️', '强阵雨'],
  85: ['🌨️', '阵雪'], 86: ['❄️', '阵雪'],
  95: ['⛈️', '雷雨'], 96: ['⛈️', '雷雨冰雹'], 99: ['⛈️', '强雷雨'],
};

function describe(code) {
  const pair = CODES[code] || CODES[0];
  return { icon: pair[0], text: pair[1] };
}

function fxKind(code) {
  if (code === 0 || code === 1) return 'sun';
  if (code === 2) return 'cloud';
  if (code === 3 || code === 45 || code === 48) return 'overcast';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'cloud';
}

const FX_MARKUP = {
  sun: '<span class="sun-halo"></span><span class="sun-disc"></span><span class="sun-dust d1"></span><span class="sun-dust d2"></span><span class="sun-dust d3"></span>',
  cloud: '<span class="cloud c-back"></span><span class="cloud c-mid"></span><span class="cloud c-front"></span>',
  overcast: '<span class="overcast-veil"></span>',
  rain: '<span class="rain-drop d1"></span><span class="rain-drop d2"></span><span class="rain-drop d3"></span><span class="rain-drop d4"></span><span class="rain-drop d5"></span><span class="rain-drop d6"></span><span class="rain-drop d7"></span><span class="rain-drop d8"></span><span class="rain-drop d9"></span><span class="rain-drop d10"></span><span class="rain-drop d11"></span><span class="rain-drop d12"></span>',
  snow: '<span class="snow s1"><i></i></span><span class="snow s2"><i></i></span><span class="snow s3"><i></i></span><span class="snow s4"><i></i></span><span class="snow s5"><i></i></span><span class="snow s6"><i></i></span><span class="snow-base"></span>',
};

function applyFx(kind) {
  if (!fxEl) return;
  fxEl.className = 'weather-fx ' + kind;
  fxEl.innerHTML = FX_MARKUP[kind] || '';
}

let card = null;
let cityEl = null;
let currentEl = null;
let metaEl = null;
let dailyEl = null;
let fxEl = null;

export function initWeather() {
  card = createCard('weather', '天气', '⛅');
  const body = cardBody(card);
  body.innerHTML = `
    <div class="weather-head">
      <span class="weather-city" data-city>未设置城市</span>
      <button class="mini-btn" data-pick type="button">选择城市</button>
      <button class="mini-btn" data-refresh type="button" title="刷新">↻</button>
    </div>
    <div class="weather-current" data-current></div>
    <div class="weather-meta" data-meta></div>
    <div class="weather-daily" data-daily></div>`;
  cityEl = body.querySelector('[data-city]');
  currentEl = body.querySelector('[data-current]');
  metaEl = body.querySelector('[data-meta]');
  dailyEl = body.querySelector('[data-daily]');
  fxEl = document.createElement('div');
  fxEl.className = 'weather-fx';
  card.appendChild(fxEl);
  body.querySelector('[data-pick]').addEventListener('click', () => openCityPicker(refreshWeather));
  body.querySelector('[data-refresh]').addEventListener('click', refreshWeather);
  refreshWeather();
  return card;
}

export function refreshWeather() {
  const s = getState();
  if (s.city) {
    cityEl.textContent = s.city.name || '未知城市';
  } else {
    cityEl.textContent = '未设置城市';
  }
  const cached = s.weather && s.weather.data ? s.weather.data : null;
  const fetchedAt = s.weather ? s.weather.fetchedAt : 0;
  render(cached);
  if (!s.city) {
    currentEl.innerHTML = '<div class="empty-hint">点击「选择城市」设置天气</div>';
    metaEl.innerHTML = '';
    dailyEl.innerHTML = '';
    return;
  }
  const stale = Date.now() - fetchedAt > 30 * 60 * 1000;
  if (stale || !cached) fetchWeather(s.city);
}

function render(data) {
  if (!data || !data.current || !data.daily) {
    currentEl.innerHTML = '<div class="empty-hint">正在获取天气…</div>';
    metaEl.innerHTML = '';
    dailyEl.innerHTML = '';
    if (fxEl) { fxEl.className = 'weather-fx'; fxEl.innerHTML = ''; }
    return;
  }
  const c = data.current;
  const info = describe(c.weather_code);
  applyFx(fxKind(c.weather_code));
  currentEl.innerHTML = `
    <span class="weather-icon">${info.icon}</span>
    <div>
      <div class="weather-temp">${Math.round(c.temperature_2m)}°C</div>
      <div class="weather-desc">${info.text}</div>
    </div>`;
  const parts = [];
  if (c.apparent_temperature != null) parts.push(`体感 ${Math.round(c.apparent_temperature)}°`);
  if (c.relative_humidity_2m != null) parts.push(`湿度 ${Math.round(c.relative_humidity_2m)}%`);
  if (c.wind_speed_10m != null) parts.push(`风 ${Math.round(c.wind_speed_10m)} km/h`);
  metaEl.textContent = parts.join(' · ');

  const days = data.daily;
  dailyEl.innerHTML = '';
  for (let i = 1; i <= 3 && i < days.time.length; i++) {
    const d = new Date(days.time[i] + 'T00:00:00');
    const infoD = describe(days.weather_code[i]);
    const div = document.createElement('div');
    div.className = 'weather-day';
    div.innerHTML = `
      <div class="wd-label">周${WEEK[d.getDay()]}</div>
      <div class="wd-icon">${infoD.icon}</div>
      <div class="wd-temp">${Math.round(days.temperature_2m_max[i])}° <span class="lo">${Math.round(days.temperature_2m_min[i])}°</span></div>`;
    dailyEl.appendChild(div);
  }
}

async function fetchWeather(city) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const s = getState();
    s.weather = { fetchedAt: Date.now(), data };
    saveState();
    render(data);
  } catch (err) {
    console.warn('天气获取失败', err);
    const s = getState();
    const name = s.city ? s.city.name : '';
    cityEl.textContent = name ? `${name} · 离线` : '未设置城市';
    if (!s.weather || !s.weather.data) {
      currentEl.innerHTML = '<div class="empty-hint">天气获取失败，请检查网络后点 ↻ 重试</div>';
    }
  }
}

let pickerOverlay = null;
let pickerCallback = null;

export function openCityPicker(onDone) {
  pickerCallback = typeof onDone === 'function' ? onDone : null;
  if (!pickerOverlay) {
    pickerOverlay = document.createElement('div');
    pickerOverlay.className = 'modal-overlay';
    pickerOverlay.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>选择城市</h3>
          <button class="icon-btn" data-close type="button" title="关闭">✕</button>
        </div>
        <input class="input" data-search type="text" placeholder="输入城市名，如：上海 / Beijing" style="width:100%" />
        <div class="city-results" data-results></div>
      </div>`;
    document.body.appendChild(pickerOverlay);
    const search = pickerOverlay.querySelector('[data-search]');
    const results = pickerOverlay.querySelector('[data-results]');
    let timer = null;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => searchCity(search.value.trim(), results), 350);
    });
    pickerOverlay.querySelector('[data-close]').addEventListener('click', closePicker);
    pickerOverlay.addEventListener('click', (e) => {
      if (e.target === pickerOverlay) closePicker();
    });
    pickerOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePicker();
    });
  }
  pickerOverlay.style.display = 'flex';
  const search = pickerOverlay.querySelector('[data-search]');
  search.value = '';
  pickerOverlay.querySelector('[data-results]').innerHTML = '<div class="city-hint">输入城市名开始搜索</div>';
  setTimeout(() => search.focus(), 50);
}

function closePicker() {
  if (pickerOverlay) pickerOverlay.style.display = 'none';
}

async function searchCity(q, resultsEl) {
  if (!q) {
    resultsEl.innerHTML = '<div class="city-hint">输入城市名开始搜索</div>';
    return;
  }
  resultsEl.innerHTML = '<div class="city-hint">搜索中…</div>';
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=zh&format=json`;
    const res = await fetch(url);
    const json = await res.json();
    const list = json.results || [];
    if (!list.length) {
      resultsEl.innerHTML = '<div class="city-hint">未找到城市，换个名字试试</div>';
      return;
    }
    resultsEl.innerHTML = '';
    for (const item of list) {
      const div = document.createElement('div');
      div.className = 'city-result';
      div.textContent = [item.name, item.admin1, item.country].filter(Boolean).join(' · ');
      div.addEventListener('click', () => {
        const s = getState();
        s.city = {
          name: item.name,
          admin1: item.admin1 || '',
          country: item.country || '',
          latitude: item.latitude,
          longitude: item.longitude,
        };
        saveState();
        closePicker();
        if (pickerCallback) pickerCallback();
      });
      resultsEl.appendChild(div);
    }
  } catch (err) {
    resultsEl.innerHTML = '<div class="city-hint">搜索失败，请检查网络</div>';
  }
}

