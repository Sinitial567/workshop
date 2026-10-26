import { getState, saveState } from './storage.js';

const PAD = 22;
const GAP = 18;
const CARD_W = 360;
const EDGE = 10;
const MIN_W = 240;
const MIN_H = 120;
const INTERACTIVE = 'input, select, textarea, button, a, label';

const SPRING_MASS = 1;
const SPRING_STIFFNESS = 500;
const DRAG_DAMPING = 44;
const SETTLE_DAMPING = 40;
const SETTLE_EPS = 0.4;
const MOVE_THRESHOLD = 8;

function clampDt(dt) {
  if (!dt || dt <= 0) return 1 / 60;
  return Math.min(Math.max(dt, 1 / 240), 1 / 48);
}

function isDesktop() {
  return window.matchMedia('(min-width: 721px)').matches;
}

export function initGrid(gridEl) {
  const s = getState();
  if (!s.layout.positions) s.layout.positions = {};

  function applyLayout() {
    if (isDesktop()) layoutCards(gridEl);
    else gridEl.style.height = '';
  }

  applyLayout();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyLayout, 150);
  });

  if (!window.matchMedia('(pointer: fine)').matches) return;

  let drag = null;
  let press = null;
  let lastHover = null;
  let zTop = 1;

  function hitZone(card, e) {
    const r = card.getBoundingClientRect();
    const left = e.clientX >= r.left - EDGE && e.clientX <= r.left + EDGE;
    const right = e.clientX >= r.right - EDGE && e.clientX <= r.right + EDGE;
    const top = e.clientY >= r.top - EDGE && e.clientY <= r.top + EDGE;
    const bottom = e.clientY >= r.bottom - EDGE && e.clientY <= r.bottom + EDGE;
    let ns = '';
    let ew = '';
    if (top) ns = 'n'; else if (bottom) ns = 's';
    if (left) ew = 'w'; else if (right) ew = 'e';
    return ns + ew || null;
  }

  function cursorFor(zone) {
    if (zone === 'e' || zone === 'w') return 'ew-resize';
    if (zone === 'n' || zone === 's') return 'ns-resize';
    if (zone === 'ne' || zone === 'sw') return 'nesw-resize';
    return 'nwse-resize';
  }

  gridEl.addEventListener('pointerdown', (e) => {
    if (!isDesktop()) return;
    const card = e.target.closest ? e.target.closest('.card') : null;
    if (!card || !gridEl.contains(card)) return;
    if (e.target.closest(INTERACTIVE)) return;
    const zone = hitZone(card, e);
    e.preventDefault();
    if (drag) {
      if (drag.raf) cancelAnimationFrame(drag.raf);
      if (drag.mode === 'move' && drag.phase === 'settle') {
        finalizeMove(drag);
      } else {
        drag.card.classList.remove('dragging');
        drag.card.style.cursor = '';
        document.body.classList.remove('is-dragging');
        drag = null;
      }
    }
    if (zone) startResize(card, e, zone);
    else {
      const rect = card.getBoundingClientRect();
      press = {
        card,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        baseLeft: parseFloat(card.style.left) || PAD,
        baseTop: parseFloat(card.style.top) || PAD,
      };
      try { gridEl.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
  });

  function startMove(card, e, p) {
    const left = p ? p.baseLeft : (parseFloat(card.style.left) || PAD);
    const top = p ? p.baseTop : (parseFloat(card.style.top) || PAD);
    const offsetX = p ? p.offsetX : 0;
    const offsetY = p ? p.offsetY : 0;
    const gridRect = gridEl.getBoundingClientRect();
    const maxLeft = Math.max(PAD, gridEl.clientWidth - card.offsetWidth);
    drag = {
      mode: 'move',
      phase: 'drag',
      card,
      pointerId: e.pointerId,
      offsetX,
      offsetY,
      baseLeft: left,
      baseTop: top,
      targetLeft: Math.min(Math.max(PAD, e.clientX - gridRect.left - offsetX), maxLeft),
      targetTop: Math.max(PAD, e.clientY - gridRect.top - offsetY),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      lastT: null,
      settleFrames: 0,
      raf: null,
    };
    card.classList.add('dragging');
    card.style.zIndex = String(++zTop);
    card.style.transform = 'translate3d(0px, 0px, 0)';
    document.body.classList.add('is-dragging');
    try { gridEl.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    drag.raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!drag || drag.mode !== 'move') return;
    const d = drag;
    const dt = clampDt(d.lastT != null ? (now - d.lastT) / 1000 : 0);
    d.lastT = now;

    const damping = d.phase === 'drag' ? DRAG_DAMPING : SETTLE_DAMPING;
    const ax = (-SPRING_STIFFNESS * (d.x - (d.targetLeft - d.baseLeft)) - damping * d.vx) / SPRING_MASS;
    const ay = (-SPRING_STIFFNESS * (d.y - (d.targetTop - d.baseTop)) - damping * d.vy) / SPRING_MASS;
    d.vx += ax * dt;
    d.vy += ay * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;

    const absLeft = d.baseLeft + d.x;
    const absTop = d.baseTop + d.y;
    const maxLeft = Math.max(PAD, gridEl.clientWidth - d.card.offsetWidth);
    if (absLeft < PAD) { d.x = PAD - d.baseLeft; if (d.vx < 0) d.vx *= -0.3; }
    else if (absLeft > maxLeft) { d.x = maxLeft - d.baseLeft; if (d.vx > 0) d.vx *= -0.3; }
    if (absTop < PAD) { d.y = PAD - d.baseTop; if (d.vy < 0) d.vy *= -0.3; }

    d.card.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;

    if (d.phase === 'settle') {
      d.settleFrames++;
      const nearX = Math.abs(d.x - (d.targetLeft - d.baseLeft)) < SETTLE_EPS && Math.abs(d.vx) < SETTLE_EPS;
      const nearY = Math.abs(d.y - (d.targetTop - d.baseTop)) < SETTLE_EPS && Math.abs(d.vy) < SETTLE_EPS;
      if ((nearX && nearY) || d.settleFrames > 120) {
        finalizeMove(d);
        return;
      }
    }
    drag.raf = requestAnimationFrame(tick);
  }

  function finalizeMove(d) {
    if (d.raf) cancelAnimationFrame(d.raf);
    const s = getState();
    const id = d.card.dataset.widget;
    const prev = s.layout.positions[id] || {};
    const maxLeft = Math.max(PAD, gridEl.clientWidth - d.card.offsetWidth);
    const left = Math.min(Math.max(PAD, Math.round(d.baseLeft + d.x)), maxLeft);
    const top = Math.max(PAD, Math.round(d.baseTop + d.y));
    d.card.style.transition = 'none';
    d.card.style.left = left + 'px';
    d.card.style.top = top + 'px';
    d.card.style.transform = '';
    void d.card.offsetWidth;
    d.card.style.transition = '';
    const pos = { x: left - PAD, y: top - PAD };
    if (prev.w != null) pos.w = prev.w;
    if (prev.h != null) pos.h = prev.h;
    s.layout.positions[id] = pos;
    d.card.classList.remove('dragging');
    d.card.style.cursor = '';
    document.body.classList.remove('is-dragging');
    updateGridHeight(gridEl);
    saveState();
    drag = null;
  }

  function startResize(card, e, zone) {
    const rect = card.getBoundingClientRect();
    drag = {
      mode: 'resize',
      axis: zone,
      card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      startLeft: parseFloat(card.style.left) || PAD,
      startTop: parseFloat(card.style.top) || PAD,
    };
    card.classList.add('dragging');
    card.style.zIndex = String(++zTop);
    card.style.cursor = cursorFor(zone);
    document.body.classList.add('is-dragging');
    try { gridEl.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
  }

  function applyResize(drag, e) {
    const card = drag.card;
    const gridW = gridEl.clientWidth;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const zone = drag.axis;
    let w = drag.startW;
    let h = drag.startH;
    let left = drag.startLeft;
    let top = drag.startTop;

    if (zone.includes('e')) {
      w = Math.max(MIN_W, drag.startW + dx);
      w = Math.min(w, Math.max(MIN_W, gridW - PAD - left));
    }
    if (zone.includes('w')) {
      const right = drag.startLeft + drag.startW;
      let nl = Math.min(drag.startLeft + dx, right - MIN_W);
      nl = Math.max(PAD, nl);
      left = nl;
      w = right - nl;
    }
    if (zone.includes('s')) {
      h = Math.max(MIN_H, drag.startH + dy);
    }
    if (zone.includes('n')) {
      const bottom = drag.startTop + drag.startH;
      let nt = Math.min(drag.startTop + dy, bottom - MIN_H);
      nt = Math.max(PAD, nt);
      top = nt;
      h = bottom - nt;
    }

    card.style.width = w + 'px';
    card.style.height = h + 'px';
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.overflow = 'auto';
  }

  gridEl.addEventListener('pointermove', (e) => {
    if (drag) {
      if (drag.mode === 'move') {
        if (drag.phase === 'drag') {
          const gridRect = gridEl.getBoundingClientRect();
          const card = drag.card;
          const maxLeft = Math.max(PAD, gridEl.clientWidth - card.offsetWidth);
          drag.targetLeft = Math.min(Math.max(PAD, e.clientX - gridRect.left - drag.offsetX), maxLeft);
          drag.targetTop = Math.max(PAD, e.clientY - gridRect.top - drag.offsetY);
        }
      } else {
        applyResize(drag, e);
      }
      return;
    }

    if (press) {
      const p = press;
      const dx = e.clientX - p.startX;
      const dy = e.clientY - p.startY;
      if (Math.hypot(dx, dy) >= MOVE_THRESHOLD) {
        press = null;
        startMove(p.card, e, p);
      }
      return;
    }

    if (!isDesktop()) return;
    const card = e.target.closest ? e.target.closest('.card') : null;
    if (lastHover && lastHover !== card) lastHover.style.cursor = '';
    lastHover = card || null;
    if (!card || !gridEl.contains(card)) return;
    const zone = hitZone(card, e);
    card.style.cursor = zone ? cursorFor(zone) : '';
  });

  function finishResize() {
    if (!drag) return;
    if (drag.raf) cancelAnimationFrame(drag.raf);
    const s = getState();
    const id = drag.card.dataset.widget;
    const card = drag.card;
    const left = parseFloat(card.style.left) || PAD;
    const top = parseFloat(card.style.top) || PAD;
    s.layout.positions[id] = {
      x: Math.round(left) - PAD,
      y: Math.round(top) - PAD,
      w: Math.round(card.offsetWidth),
      h: Math.round(card.offsetHeight),
    };
    card.classList.remove('dragging');
    card.style.cursor = '';
    document.body.classList.remove('is-dragging');
    updateGridHeight(gridEl);
    saveState();
    drag = null;
  }

  gridEl.addEventListener('pointerup', () => {
    if (press) { press = null; return; }
    if (!drag) return;
    if (drag.mode === 'move') {
      drag.settleFrames = 0;
      drag.phase = 'settle';
      return;
    }
    finishResize();
  });

  gridEl.addEventListener('pointercancel', () => {
    if (press) { press = null; return; }
    if (!drag) return;
    if (drag.mode === 'move') {
      finalizeMove(drag);
      return;
    }
    finishResize();
  });
}

function layoutCards(gridEl) {
  const s = getState();
  s.layout.positions = s.layout.positions || {};
  const cards = [...gridEl.querySelectorAll('.card')].filter(c => c.style.display !== 'none');
  const innerWidth = gridEl.clientWidth - PAD * 2;
  const cols = Math.max(1, Math.floor((innerWidth + GAP) / (CARD_W + GAP)));
  const colHeights = new Array(cols).fill(0);

  for (const card of cards) {
    const id = card.dataset.widget;
    let pos = s.layout.positions[id];
    if (!pos) {
      const h = card.offsetHeight || 260;
      const col = colHeights.indexOf(Math.min(...colHeights));
      pos = { x: col * (CARD_W + GAP), y: colHeights[col] };
      colHeights[col] += h + GAP;
      s.layout.positions[id] = pos;
    }
    card.style.left = (PAD + pos.x) + 'px';
    card.style.top = (PAD + pos.y) + 'px';
    if (pos.w != null) card.style.width = pos.w + 'px';
    if (pos.h != null) { card.style.height = pos.h + 'px'; card.style.overflow = 'auto'; }
  }
  updateGridHeight(gridEl);
  saveState();
}

function updateGridHeight(gridEl) {
  if (!isDesktop()) return;
  let bottom = 0;
  for (const card of gridEl.querySelectorAll('.card')) {
    if (card.style.display === 'none') continue;
    const b = card.offsetTop + card.offsetHeight;
    if (b > bottom) bottom = b;
  }
  gridEl.style.height = (bottom + PAD) + 'px';
}
