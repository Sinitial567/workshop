import { createCard, cardBody, el, escapeHtml, uid, animateIn } from './ui.js';
import { getState, saveState } from './storage.js';

const COLORS = ['#ffd166', '#f4a261', '#7bd88f', '#6cc7e8', '#b99aff', '#f78fb3', '#a8c0d0'];
const NOTE_EDGE = 8;
const NOTE_MIN_W = 96;
const NOTE_MIN_H = 72;
const NOTE_DEF_W = 168;
const NOTE_DEF_H = 136;
const INTERACTIVE = 'textarea, button, a, select, input';

export function initNotes() {
  const card = createCard('notes', '便签', '📝');
  const body = cardBody(card);
  body.innerHTML = `
    <div class="notes-toolbar">
      <button class="btn" data-add type="button">＋ 新建便签</button>
    </div>
    <div class="notes-grid"></div>`;
  const grid = body.querySelector('.notes-grid');
  let saveTimer = null;
  let pendingDelete = null;
  let confirmTimer = null;

  for (const n of getState().notes) {
    if (n.fixed == null) n.fixed = true;
    if (n.editing == null) n.editing = false;
  }

  function ensureGeometry(n, index) {
    if (n.x == null || n.y == null) {
      n.x = 12 + (index % 3) * (NOTE_DEF_W + 12);
      n.y = 12 + Math.floor(index / 3) * (NOTE_DEF_H + 12);
    }
    if (n.w == null) n.w = NOTE_DEF_W;
    if (n.h == null) n.h = NOTE_DEF_H;
  }

  function nextColor() {
    const notes = getState().notes;
    return COLORS[notes.length % COLORS.length];
  }

  function updateStageHeight() {
    let bottom = 0;
    for (const n of getState().notes) {
      const b = (n.y || 0) + (n.h || NOTE_DEF_H);
      if (b > bottom) bottom = b;
    }
    grid.style.height = Math.max(180, bottom + 16) + 'px';
  }

  body.querySelector('[data-add]').addEventListener('click', () => {
    const notes = getState().notes;
    const note = {
      id: uid(), text: '', color: nextColor(), createdAt: Date.now(),
      fixed: false, editing: false,
    };
    ensureGeometry(note, notes.length);
    notes.unshift(note);
    saveState();
    render();
    const noteEl = grid.querySelector(`.note[data-id="${note.id}"]`);
    if (noteEl) animateIn(noteEl);
    updateStageHeight();
  });

  grid.addEventListener('input', (e) => {
    const noteEl = e.target.closest('.note');
    if (!noteEl) return;
    const note = getState().notes.find(n => n.id === noteEl.dataset.id);
    if (!note) return;
    note.text = e.target.value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 300);
  });

  grid.addEventListener('click', (e) => {
    const noteEl = e.target.closest('.note');
    const btnDel = e.target.closest('[data-del]');

    if (btnDel && noteEl) {
      const note = getState().notes.find(n => n.id === noteEl.dataset.id);
      if (!note) return;
      if (pendingDelete === note.id) {
        const arr = getState().notes;
        const idx = arr.findIndex(n => n.id === note.id);
        if (idx > -1) arr.splice(idx, 1);
        pendingDelete = null;
        clearTimeout(confirmTimer);
        saveState();
        render();
        updateStageHeight();
      } else {
        pendingDelete = note.id;
        render();
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => {
          if (pendingDelete) { pendingDelete = null; render(); }
        }, 3000);
      }
      return;
    }

    if (pendingDelete) {
      pendingDelete = null;
      clearTimeout(confirmTimer);
      if (!noteEl) { render(); return; }
    }

    if (!noteEl) return;
    const note = getState().notes.find(n => n.id === noteEl.dataset.id);
    if (!note) return;

    if (e.target.closest('[data-fix]')) {
      note.fixed = true;
      note.editing = false;
      saveState();
      render();
      updateStageHeight();
    } else if (e.target.closest('[data-color]')) {
      const i = COLORS.indexOf(note.color);
      note.color = COLORS[(i + 1) % COLORS.length];
      saveState();
      render();
    } else if (e.target.closest('[data-edit]')) {
      if (note.editing) {
        note.editing = false;
      } else {
        getState().notes.forEach(x => { if (x !== note) x.editing = false; });
        note.editing = true;
      }
      saveState();
      render();
      updateStageHeight();
      if (note.editing) {
        const ta = grid.querySelector(`.note[data-id="${note.id}"] textarea`);
        if (ta) ta.focus();
      }
    }
  });

  function render() {
    grid.innerHTML = '';
    const notes = getState().notes;
    if (!notes.length) {
      grid.innerHTML = '<div class="empty-hint">点击「新建便签」记录想法</div>';
      return;
    }
    notes.forEach((n, i) => ensureGeometry(n, i));
    for (const n of notes) {
      const isFixed = !!n.fixed;
      const isEditing = isFixed && !!n.editing;
      const actions = isFixed
        ? `<button class="mini-btn" data-color type="button" title="调色">🎨</button>
           <button class="mini-btn" data-edit type="button" title="${isEditing ? '完成' : '编辑'}">${isEditing ? '✓' : '✏️'}</button>`
        : `<button class="mini-btn" data-fix type="button" title="固定">✓</button>`;
      const del = isEditing
        ? `<button class="mini-btn note-delete${pendingDelete === n.id ? ' confirm' : ''}" data-del type="button" title="删除">${pendingDelete === n.id ? '确认删除?' : '✕'}</button>`
        : '';
      const placeholder = !isFixed ? '拖动摆放 · 点 ✓ 固定' : (isEditing ? '写点什么…' : '已固定 · 点 ✏️ 编辑');
      const note = el(`
        <div class="note${isFixed ? ' fixed' : ''}${isEditing ? ' editing' : ''}" data-id="${n.id}" style="left:${n.x}px; top:${n.y}px; width:${n.w}px; height:${n.h}px; background:${n.color}">
          ${del}
          <textarea placeholder="${placeholder}" spellcheck="false"${isEditing ? '' : ' readonly'}>${escapeHtml(n.text)}</textarea>
          <div class="note-actions">${actions}</div>
        </div>`);
      grid.appendChild(note);
    }
  }

  let drag = null;
  let lastNote = null;

  function hitZone(note, e) {
    const r = note.getBoundingClientRect();
    const l = e.clientX >= r.left - NOTE_EDGE && e.clientX <= r.left + NOTE_EDGE;
    const rt = e.clientX >= r.right - NOTE_EDGE && e.clientX <= r.right + NOTE_EDGE;
    const t = e.clientY >= r.top - NOTE_EDGE && e.clientY <= r.top + NOTE_EDGE;
    const b = e.clientY >= r.bottom - NOTE_EDGE && e.clientY <= r.bottom + NOTE_EDGE;
    let ns = '';
    let ew = '';
    if (t) ns = 'n'; else if (b) ns = 's';
    if (l) ew = 'w'; else if (rt) ew = 'e';
    return ns + ew || null;
  }

  function cursorFor(zone) {
    if (zone === 'e' || zone === 'w') return 'ew-resize';
    if (zone === 'n' || zone === 's') return 'ns-resize';
    if (zone === 'ne' || zone === 'sw') return 'nesw-resize';
    return 'nwse-resize';
  }

  function startNoteDrag(note, e, mode, zone) {
    const rect = note.getBoundingClientRect();
    drag = {
      mode,
      zone,
      note,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startLeft: parseFloat(note.style.left) || 0,
      startTop: parseFloat(note.style.top) || 0,
      startW: rect.width,
      startH: rect.height,
    };
    note.style.zIndex = '10';
    note.classList.add('dragging');
    note.style.cursor = zone ? cursorFor(zone) : 'grabbing';
    document.body.classList.add('is-dragging');
    try { grid.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
  }

  grid.addEventListener('pointerdown', (e) => {
    const note = e.target.closest ? e.target.closest('.note') : null;
    if (!note || !grid.contains(note)) return;
    const n = getState().notes.find(x => x.id === note.dataset.id);
    if (!n) return;

    if (e.target.closest('button')) return;
    if (n.fixed && n.editing) return;
    const zone = hitZone(note, e);
    e.preventDefault();
    e.stopPropagation();
    startNoteDrag(note, e, zone ? 'resize' : 'move', zone);
  });

  grid.addEventListener('pointermove', (e) => {
    if (!drag) {
      const note = e.target.closest ? e.target.closest('.note') : null;
      if (lastNote && lastNote !== note) lastNote.style.cursor = '';
      lastNote = note || null;
      if (note && grid.contains(note)) {
        const n = getState().notes.find(x => x.id === note.dataset.id);
        if (n && !(n.fixed && n.editing)) {
          const zone = hitZone(note, e);
          note.style.cursor = zone ? cursorFor(zone) : '';
        }
      }
      return;
    }
    e.preventDefault();
    const note = drag.note;
    const stageRect = grid.getBoundingClientRect();
    const stageW = grid.clientWidth;
    const stageH = grid.clientHeight;

    if (drag.mode === 'move') {
      const maxLeft = Math.max(0, stageW - note.offsetWidth);
      const left = Math.min(Math.max(0, e.clientX - stageRect.left - drag.offsetX), maxLeft);
      const maxTop = Math.max(0, stageH - note.offsetHeight);
      const top = Math.min(Math.max(0, e.clientY - stageRect.top - drag.offsetY), maxTop);
      note.style.left = left + 'px';
      note.style.top = top + 'px';
      return;
    }

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    let w = drag.startW;
    let h = drag.startH;
    let left = drag.startLeft;
    let top = drag.startTop;
    const zone = drag.zone;

    if (zone.includes('e')) {
      w = Math.max(NOTE_MIN_W, Math.min(drag.startW + dx, stageW - left));
    }
    if (zone.includes('w')) {
      const right = drag.startLeft + drag.startW;
      let nl = Math.min(drag.startLeft + dx, right - NOTE_MIN_W);
      nl = Math.max(0, nl);
      left = nl;
      w = right - nl;
    }
    if (zone.includes('s')) {
      h = Math.max(NOTE_MIN_H, drag.startH + dy);
    }
    if (zone.includes('n')) {
      const bottom = drag.startTop + drag.startH;
      let nt = Math.min(drag.startTop + dy, bottom - NOTE_MIN_H);
      nt = Math.max(0, nt);
      top = nt;
      h = bottom - nt;
    }

    note.style.left = left + 'px';
    note.style.top = top + 'px';
    note.style.width = w + 'px';
    note.style.height = h + 'px';
  });

  function endNoteDrag() {
    if (!drag) return;
    const note = drag.note;
    const n = getState().notes.find(x => x.id === note.dataset.id);
    if (n) {
      n.x = Math.round(parseFloat(note.style.left) || 0);
      n.y = Math.round(parseFloat(note.style.top) || 0);
      n.w = Math.round(note.offsetWidth);
      n.h = Math.round(note.offsetHeight);
    }
    note.style.zIndex = '';
    note.classList.remove('dragging');
    note.style.cursor = '';
    document.body.classList.remove('is-dragging');
    saveState();
    updateStageHeight();
    drag = null;
  }

  grid.addEventListener('pointerup', endNoteDrag);
  grid.addEventListener('pointercancel', endNoteDrag);

  render();
  updateStageHeight();
  return card;
}
