/* =====================
   State & Storage
   ===================== */
const STORAGE_KEY = 'planning_data_v1';

let state = {
  users: [],
  slots: [],
  view: 'week',
  currentDate: new Date(),
};

let editingUserId = null;
let editingSlotId = null;
let dragState = null;
let cancelDrag = null;
let currentTimeInterval = null;

// SNAP granularity in minutes
const SNAP_MIN = 15;

/* =====================
   Data helpers
   ===================== */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.users) state.users = d.users;
      if (d.slots) state.slots = d.slots;
    }
  } catch (e) { console.warn('Failed to load data', e); }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ users: state.users, slots: state.slots }));
}

function exportData() {
  const json = JSON.stringify({ users: state.users, slots: state.slots }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planning-${formatDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const d = JSON.parse(e.target.result);
      if (d.users && d.slots) {
        state.users = d.users;
        state.slots = d.slots;
        saveData();
        renderAll();
        showToast('Données importées avec succès');
      }
    } catch {
      showToast('Fichier invalide', 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* =====================
   Date utilities
   ===================== */
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  return new Date(y, m-1, d);
}

function formatTime(h, min) {
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

function timeToMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(mins) {
  return formatTime(Math.floor(mins/60), mins%60);
}

function slotDurationMin(slot) {
  return timeToMin(slot.end) - timeToMin(slot.start);
}

function getWeekStart(d) {
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAY_NAMES_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const DAY_NAMES = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

/* =====================
   Navigation
   ===================== */
function setView(v) {
  state.view = v;
  document.getElementById('btn-week').classList.toggle('active', v === 'week');
  document.getElementById('btn-month').classList.toggle('active', v === 'month');
  document.getElementById('week-view').classList.toggle('hidden', v !== 'week');
  document.getElementById('month-view').classList.toggle('hidden', v !== 'month');
  renderCalendar();
}

function navigate(dir) {
  if (state.view === 'week') {
    state.currentDate = addDays(state.currentDate, dir * 7);
  } else {
    state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + dir, 1);
  }
  renderCalendar();
}

function goToToday() {
  state.currentDate = new Date();
  renderCalendar();
}

function updatePeriodLabel() {
  const el = document.getElementById('current-period');
  if (state.view === 'week') {
    const ws = getWeekStart(state.currentDate);
    const we = addDays(ws, 6);
    if (ws.getMonth() === we.getMonth()) {
      el.textContent = `${ws.getDate()} – ${we.getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`;
    } else {
      el.textContent = `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${ws.getFullYear()}`;
    }
  } else {
    el.textContent = `${MONTH_NAMES[state.currentDate.getMonth()]} ${state.currentDate.getFullYear()}`;
  }
}

/* =====================
   Week View Rendering
   ===================== */
const HOUR_START = 0;
const HOUR_END = 24;

function renderWeekView() {
  const ws = getWeekStart(state.currentDate);
  const days = Array.from({length: 7}, (_, i) => addDays(ws, i));
  const today = new Date();
  const container = document.getElementById('week-view');

  // Build header
  let headerHtml = `<div class="week-header-row" style="grid-template-columns:${CSS.escape? '' : ''}${`var(--time-col-width) repeat(7, 1fr)`}">`;
  headerHtml += `<div class="week-time-header"></div>`;
  days.forEach(day => {
    const isToday = sameDay(day, today);
    headerHtml += `<div class="week-day-header${isToday?' today':''}" onclick="openSlotModal(null,'${formatDate(day)}')">
      <span style="font-size:11px">${DAY_NAMES_SHORT[day.getDay()]}</span>
      <span class="day-num">${day.getDate()}</span>
    </div>`;
  });
  headerHtml += '</div>';

  // Build body
  let bodyHtml = `<div class="week-body">`;
  // Time column
  bodyHtml += `<div class="week-time-col">`;
  for (let h = HOUR_START; h < HOUR_END; h++) {
    bodyHtml += `<div class="hour-label">${h > 0 ? String(h).padStart(2,'0')+'h' : ''}</div>`;
  }
  bodyHtml += '</div>';

  // Days grid
  bodyHtml += `<div class="week-days-grid" id="week-days-grid" style="grid-template-columns:repeat(7,1fr)">`;
  days.forEach((day, di) => {
    const dateStr = formatDate(day);
    bodyHtml += `<div class="week-day-col" data-date="${dateStr}">`;
    for (let h = HOUR_START; h < HOUR_END; h++) {
      bodyHtml += `<div class="week-hour-cell" data-date="${dateStr}" data-hour="${h}" data-min="0"></div>`;
    }
    bodyHtml += '</div>';
  });
  bodyHtml += '</div>'; // week-days-grid
  bodyHtml += '</div>'; // week-body

  container.innerHTML = headerHtml + bodyHtml;

  // Render slots
  renderWeekSlots(days);

  // Current time line
  if (days.some(d => sameDay(d, today))) {
    renderCurrentTimeLine(days, today);
  }

  // Drop zones
  setupWeekDropZones();
}

function renderWeekSlots(days) {
  const grid = document.getElementById('week-days-grid');
  if (!grid) return;
  const cols = grid.querySelectorAll('.week-day-col');
  const ws = formatDate(days[0]);
  const we = formatDate(days[6]);

  const weekSlots = state.slots.filter(s => s.date >= ws && s.date <= we);

  weekSlots.forEach(slot => {
    const dayIdx = days.findIndex(d => formatDate(d) === slot.date);
    if (dayIdx < 0) return;
    const col = cols[dayIdx];
    if (!col) return;

    const startMin = timeToMin(slot.start) - HOUR_START * 60;
    const endMin = timeToMin(slot.end) - HOUR_START * 60;
    const totalMin = (HOUR_END - HOUR_START) * 60;
    const top = (startMin / totalMin) * 100;
    const height = ((endMin - startMin) / totalMin) * 100;

    const el = document.createElement('div');
    el.className = 'slot-block';
    el.dataset.slotId = slot.id;
    el.style.top = `${top}%`;
    el.style.height = `${Math.max(height, 1.2)}%`;
    el.style.background = slot.color || '#4f86f7';
    el.style.color = getContrastColor(slot.color || '#4f86f7');

    const assignedUsers = (slot.userIds || []).map(uid => state.users.find(u => u.id === uid)).filter(Boolean);
    const userDots = assignedUsers.map(u => `<span class="slot-user-dot" style="background:${u.color}" title="${u.name}"></span>`).join('');
    const userNames = assignedUsers.map(u => u.name).join(', ');

    el.innerHTML = `
      <div class="slot-title">${escapeHtml(slot.title || 'Créneau')}</div>
      <div class="slot-time">${slot.start}–${slot.end}</div>
      ${assignedUsers.length ? `<div class="slot-users">${userDots} ${escapeHtml(userNames)}</div>` : ''}
    `;

    el.addEventListener('click', (e) => { e.stopPropagation(); openSlotModal(slot.id); });
    el.addEventListener('mousedown', (e) => startDrag(e, slot));

    col.appendChild(el);
  });
}

function renderCurrentTimeLine(days, today) {
  const grid = document.getElementById('week-days-grid');
  if (!grid) return;
  const cols = grid.querySelectorAll('.week-day-col');
  const dayIdx = days.findIndex(d => sameDay(d, today));
  if (dayIdx < 0) return;
  const col = cols[dayIdx];
  const now = today;
  const nowMin = now.getHours() * 60 + now.getMinutes() - HOUR_START * 60;
  const totalMin = (HOUR_END - HOUR_START) * 60;
  const top = (nowMin / totalMin) * 100;
  const line = document.createElement('div');
  line.className = 'current-time-line';
  line.style.top = `${top}%`;
  col.appendChild(line);
}

/* =====================
   Month View Rendering
   ===================== */
function renderMonthView() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();

  // Start from Monday
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const container = document.getElementById('month-view');
  let html = `<div class="month-header-row">`;
  ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(d => {
    html += `<div class="month-header-cell">${d}</div>`;
  });
  html += '</div>';
  html += '<div class="month-grid">';

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(addDays(firstDay, -(startDay - i)));
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) for (let i = 1; i <= remaining; i++) cells.push(addDays(lastDay, i));

  cells.forEach(cellDate => {
    const dateStr = formatDate(cellDate);
    const isToday = sameDay(cellDate, today);
    const isOther = cellDate.getMonth() !== month;
    const daySlots = state.slots.filter(s => s.date === dateStr);
    const MAX_SHOW = 3;

    html += `<div class="month-cell${isToday?' today':''}${isOther?' other-month':''}" data-date="${dateStr}" onclick="handleMonthCellClick(event, '${dateStr}')">`;
    html += `<div class="month-day-num">${cellDate.getDate()}</div>`;
    daySlots.slice(0, MAX_SHOW).forEach(slot => {
      html += `<span class="month-slot-pill" style="background:${slot.color||'#4f86f7'};color:${getContrastColor(slot.color||'#4f86f7')}" 
        onclick="event.stopPropagation();openSlotModal('${slot.id}')">${escapeHtml(slot.title||'Créneau')}</span>`;
    });
    if (daySlots.length > MAX_SHOW) {
      html += `<div class="month-more">+${daySlots.length - MAX_SHOW} autres</div>`;
    }
    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

function handleMonthCellClick(event, dateStr) {
  openSlotModal(null, dateStr);
}

/* =====================
   Drag & Drop — Existing Slot
   ===================== */
function startDrag(e, slot) {
  if (e.button !== 0) return;
  e.stopPropagation(); // prevent grid-draw from firing
  e.preventDefault();

  // Record where inside the slot the user grabbed
  let grabOffsetMin = 0;
  const slotEl = e.currentTarget;
  if (slotEl) {
    const rect = slotEl.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const dur = slotDurationMin(slot);
    grabOffsetMin = Math.round((relY / rect.height) * dur / SNAP_MIN) * SNAP_MIN;
  }

  const ghost = document.getElementById('drag-ghost');
  ghost.textContent = slot.title || 'Créneau';
  ghost.style.background = slot.color || '#4f86f7';
  ghost.style.color = getContrastColor(slot.color || '#4f86f7');
  ghost.classList.remove('hidden');
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;

  dragState = { slot, grabOffsetMin };

  const orig = document.querySelector(`.slot-block[data-slot-id="${slot.id}"]`);
  if (orig) orig.classList.add('dragging');

  const onMouseMove = (ev) => {
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    if (target) {
      const col = target.closest('.week-day-col') || target.closest('.month-cell');
      if (col) col.classList.add('drop-target');
    }
  };

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    if (target && dragState) {
      let newDate = null;
      let newStartMin = null;

      if (state.view === 'week') {
        const col = target.closest('.week-day-col');
        if (col) {
          newDate = col.dataset.date;
          const rect = col.getBoundingClientRect();
          const fraction = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
          const rawMin = HOUR_START * 60 + Math.round(fraction * (HOUR_END - HOUR_START) * 60 / SNAP_MIN) * SNAP_MIN;
          newStartMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - slotDurationMin(slot), rawMin - grabOffsetMin));
          newStartMin = Math.round(newStartMin / SNAP_MIN) * SNAP_MIN;
        }
      } else {
        const cell = target.closest('.month-cell');
        if (cell) newDate = cell.dataset.date;
      }

      if (newDate || newStartMin !== null) {
        const slotIdx = state.slots.findIndex(s => s.id === dragState.slot.id);
        if (slotIdx >= 0) {
          const s = state.slots[slotIdx];
          const dur = slotDurationMin(s);
          const oldDate = s.date;
          const oldStartMin = timeToMin(s.start);
          const finalDate = newDate || oldDate;
          const finalStartMin = newStartMin !== null ? newStartMin : oldStartMin;

          if (finalDate !== oldDate || Math.abs(finalStartMin - oldStartMin) >= SNAP_MIN) {
            s.date = finalDate;
            s.start = minToTime(finalStartMin);
            s.end = minToTime(finalStartMin + dur);
            saveData();
            renderAll();
            showToast('Créneau déplacé');
          }
        }
      }
    }

    document.querySelectorAll('.slot-block.dragging').forEach(el => el.classList.remove('dragging'));
    dragState = null;
  };

  cancelDrag = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    document.querySelectorAll('.slot-block.dragging').forEach(el => el.classList.remove('dragging'));
    dragState = null;
    cancelDrag = null;
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/* =====================
   Grid Draw — Create slot by click-drag
   ===================== */
function startGridDraw(e, col) {
  if (e.button !== 0) return;
  if (e.target.closest('.slot-block') || e.target.closest('.current-time-line')) return;
  e.preventDefault();

  const dateStr = col.dataset.date;
  const totalMin = (HOUR_END - HOUR_START) * 60;

  function yToSnappedMin(y) {
    const rect = col.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    const raw = HOUR_START * 60 + Math.round(fraction * totalMin / SNAP_MIN) * SNAP_MIN;
    return Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - SNAP_MIN, raw));
  }

  const anchorMin = yToSnappedMin(e.clientY);

  // Create visual preview
  const preview = document.createElement('div');
  preview.className = 'grid-selection-preview';
  col.appendChild(preview);

  function updatePreview(curMin) {
    const startMin = Math.min(anchorMin, curMin);
    const endMin = Math.max(anchorMin + SNAP_MIN, curMin);
    const top = ((startMin - HOUR_START * 60) / totalMin) * 100;
    const height = ((endMin - startMin) / totalMin) * 100;
    preview.style.top = `${top}%`;
    preview.style.height = `${Math.max(height, 0.5)}%`;
    preview.dataset.time = `${minToTime(startMin)} – ${minToTime(endMin)}`;
  }

  updatePreview(anchorMin + 60); // default 1h

  const onMouseMove = (ev) => {
    updatePreview(yToSnappedMin(ev.clientY));
  };

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    preview.remove();

    let endMin = yToSnappedMin(ev.clientY);
    if (endMin <= anchorMin) endMin = anchorMin + 60;
    if (endMin - anchorMin < SNAP_MIN) endMin = anchorMin + SNAP_MIN;

    openSlotModal(null, dateStr, minToTime(anchorMin), minToTime(endMin));
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/* =====================
   User Drag — assign by dragging from panel
   ===================== */
function startUserDrag(e, user) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const ghost = document.getElementById('drag-ghost');
  ghost.textContent = user.name;
  ghost.style.background = user.color;
  ghost.style.color = getContrastColor(user.color);
  ghost.classList.remove('hidden');
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;

  const onMouseMove = (ev) => {
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (hit) {
      const col = hit.closest('.week-day-col');
      const slotBlock = hit.closest('.slot-block');
      if (slotBlock) slotBlock.classList.add('drop-target');
      else if (col) col.classList.add('drop-target');
    }
  };

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!hit) return;

    // Dropped onto an existing slot → directly assign user
    const slotBlock = hit.closest('.slot-block');
    if (slotBlock) {
      const slotId = slotBlock.dataset.slotId;
      const slotIdx = state.slots.findIndex(s => s.id === slotId);
      if (slotIdx >= 0) {
        const s = state.slots[slotIdx];
        if (!(s.userIds || []).includes(user.id)) {
          s.userIds = [...(s.userIds || []), user.id];
          saveData();
          renderAll();
          showToast(`${user.name} assigné(e)`);
        } else {
          showToast(`${user.name} est déjà assigné(e)`, 'error');
        }
      }
      return;
    }

    // Dropped onto an empty column area → open creation modal
    const col = hit.closest('.week-day-col');
    if (col && state.view === 'week') {
      const dateStr = col.dataset.date;
      const rect = col.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      const totalMin = (HOUR_END - HOUR_START) * 60;
      const rawStart = HOUR_START * 60 + Math.round(fraction * totalMin / SNAP_MIN) * SNAP_MIN;
      const startMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - 60, rawStart));
      openSlotModal(null, dateStr, minToTime(startMin), minToTime(startMin + 60), [user.id]);
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function setupWeekDropZones() {
  const grid = document.getElementById('week-days-grid');
  if (!grid) return;
  grid.querySelectorAll('.week-day-col').forEach(col => {
    col.addEventListener('mousedown', (e) => startGridDraw(e, col));
  });
}

/* =====================
   Confirm Modal
   ===================== */
let _confirmResolve = null;

function showConfirm(message, title = 'Confirmation', okLabel = 'Supprimer', okClass = 'btn-danger') {
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    const okBtn = document.getElementById('confirm-modal-ok');
    okBtn.textContent = okLabel;
    okBtn.className = `btn ${okClass}`;
    showModal('confirm-modal');
  });
}

function resolveConfirm(result) {
  closeAllModals();
  if (_confirmResolve) {
    _confirmResolve(result);
    _confirmResolve = null;
  }
}

/* =====================
   Slot Modal
   ===================== */
function openSlotModal(slotId, defaultDate, defaultStart, defaultEnd, defaultUserIds) {
  editingSlotId = slotId || null;
  const modal = document.getElementById('slot-modal');
  const title = document.getElementById('slot-modal-title');
  const deleteBtn = document.getElementById('slot-delete-btn');

  // Populate user checkboxes
  const cbContainer = document.getElementById('slot-users-checkboxes');
  cbContainer.innerHTML = state.users.map(u =>
    `<label>
      <input type="checkbox" value="${u.id}" />
      <span class="slot-user-dot" style="background:${u.color}"></span>
      ${escapeHtml(u.name)}
    </label>`
  ).join('');

  if (slotId) {
    const slot = state.slots.find(s => s.id === slotId);
    if (!slot) return;
    title.textContent = 'Modifier le créneau';
    deleteBtn.style.display = '';
    document.getElementById('slot-title').value = slot.title || '';
    document.getElementById('slot-date').value = slot.date;
    document.getElementById('slot-start').value = slot.start;
    document.getElementById('slot-end').value = slot.end;
    document.getElementById('slot-color').value = slot.color || '#4f86f7';
    document.getElementById('slot-notes').value = slot.notes || '';
    (slot.userIds || []).forEach(preUid => {
      const cb = cbContainer.querySelector(`input[value="${preUid}"]`);
      if (cb) cb.checked = true;
    });
  } else {
    title.textContent = 'Nouveau créneau';
    deleteBtn.style.display = 'none';
    document.getElementById('slot-title').value = '';
    document.getElementById('slot-date').value = defaultDate || formatDate(state.currentDate);
    document.getElementById('slot-start').value = defaultStart || '08:00';
    document.getElementById('slot-end').value = defaultEnd || '12:00';
    document.getElementById('slot-color').value = '#4f86f7';
    document.getElementById('slot-notes').value = '';
    if (defaultUserIds && defaultUserIds.length) {
      defaultUserIds.forEach(preUid => {
        const cb = cbContainer.querySelector(`input[value="${preUid}"]`);
        if (cb) cb.checked = true;
      });
    }
  }

  showModal('slot-modal');
}

function saveSlot() {
  const title = document.getElementById('slot-title').value.trim();
  const date = document.getElementById('slot-date').value;
  const start = document.getElementById('slot-start').value;
  const end = document.getElementById('slot-end').value;
  const color = document.getElementById('slot-color').value;
  const notes = document.getElementById('slot-notes').value.trim();

  if (!date || !start || !end) {
    showToast('Veuillez remplir la date et les horaires', 'error');
    return;
  }
  if (timeToMin(end) <= timeToMin(start)) {
    showToast("L'heure de fin doit être après l'heure de début", 'error');
    return;
  }

  const userIds = Array.from(
    document.querySelectorAll('#slot-users-checkboxes input:checked')
  ).map(cb => cb.value);

  if (editingSlotId) {
    const idx = state.slots.findIndex(s => s.id === editingSlotId);
    if (idx >= 0) {
      Object.assign(state.slots[idx], { title, date, start, end, color, notes, userIds });
    }
  } else {
    state.slots.push({ id: uid(), title, date, start, end, color, notes, userIds });
  }

  saveData();
  closeAllModals();
  renderAll();
  showToast('Créneau enregistré');
}

async function deleteSlot() {
  if (!editingSlotId) return;
  const ok = await showConfirm('Supprimer ce créneau ?');
  if (!ok) return;
  state.slots = state.slots.filter(s => s.id !== editingSlotId);
  saveData();
  closeAllModals();
  renderAll();
  showToast('Créneau supprimé');
}

/* =====================
   Users Modal
   ===================== */
function openUsersModal() {
  editingUserId = null;
  renderUsersList();
  clearUserForm();
  document.getElementById('user-cancel-edit-btn').style.display = 'none';
  document.getElementById('user-form-title').textContent = 'Ajouter un utilisateur';
  showModal('users-modal');
}

function renderUsersList() {
  const container = document.getElementById('users-list');
  if (state.users.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Aucun utilisateur</p>';
    return;
  }
  container.innerHTML = state.users.map(u => `
    <div class="user-row">
      <div class="user-avatar" style="background:${u.color}">${userInitials(u.name)}</div>
      <div style="flex:1">
        <div class="user-row-name">${escapeHtml(u.name)}</div>
        <div class="user-row-rules">${u.maxHours}h/sem · repos ${u.restHours}h · max ${u.maxDaily}h/j</div>
      </div>
      <button class="icon-btn" onclick="editUser('${u.id}')" title="Modifier">✏️</button>
      <button class="icon-btn" onclick="removeUser('${u.id}')" title="Supprimer">🗑️</button>
    </div>
  `).join('');
}

function editUser(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  editingUserId = userId;
  document.getElementById('user-name').value = user.name;
  document.getElementById('user-color').value = user.color;
  document.getElementById('user-max-hours').value = user.maxHours;
  document.getElementById('user-rest-hours').value = user.restHours;
  document.getElementById('user-max-daily').value = user.maxDaily;
  document.getElementById('user-form-title').textContent = 'Modifier l\'utilisateur';
  document.getElementById('user-cancel-edit-btn').style.display = '';
}

function cancelEditUser() {
  editingUserId = null;
  clearUserForm();
  document.getElementById('user-form-title').textContent = 'Ajouter un utilisateur';
  document.getElementById('user-cancel-edit-btn').style.display = 'none';
}

function clearUserForm() {
  document.getElementById('user-name').value = '';
  document.getElementById('user-color').value = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6,'0');
  document.getElementById('user-max-hours').value = 35;
  document.getElementById('user-rest-hours').value = 11;
  document.getElementById('user-max-daily').value = 10;
}

function saveUser() {
  const name = document.getElementById('user-name').value.trim();
  if (!name) { showToast('Le nom est requis', 'error'); return; }

  const data = {
    name,
    color: document.getElementById('user-color').value,
    maxHours: Number(document.getElementById('user-max-hours').value),
    restHours: Number(document.getElementById('user-rest-hours').value),
    maxDaily: Number(document.getElementById('user-max-daily').value),
  };

  if (editingUserId) {
    const idx = state.users.findIndex(u => u.id === editingUserId);
    if (idx >= 0) Object.assign(state.users[idx], data);
  } else {
    state.users.push({ id: uid(), ...data });
  }

  saveData();
  cancelEditUser();
  renderUsersList();
  renderDashboard();
  showToast('Utilisateur enregistré');
}

async function removeUser(userId) {
  const ok = await showConfirm('Supprimer cet utilisateur ? Ses assignations seront retirées.', 'Supprimer l’utilisateur');
  if (!ok) return;
  state.users = state.users.filter(u => u.id !== userId);
  state.slots.forEach(s => {
    s.userIds = (s.userIds || []).filter(id => id !== userId);
  });
  saveData();
  renderUsersList();
  renderAll();
  showToast('Utilisateur supprimé');
}

/* =====================
   Dashboard
   ===================== */
function renderDashboard() {
  const container = document.getElementById('dashboard-content');
  if (state.users.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Ajoutez des utilisateurs pour voir les statistiques.</p>';
    return;
  }

  const ws = getWeekStart(state.currentDate);
  const we = addDays(ws, 6);
  const wsStr = formatDate(ws);
  const weStr = formatDate(we);

  let html = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Semaine du ${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]}</div>`;

  state.users.forEach(user => {
    const weekSlots = state.slots.filter(s => s.date >= wsStr && s.date <= weStr && (s.userIds||[]).includes(user.id));
    const totalSlots = state.slots.filter(s => (s.userIds||[]).includes(user.id));

    const weekMin = weekSlots.reduce((acc, s) => acc + slotDurationMin(s), 0);
    const weekHours = weekMin / 60;
    const totalHours = totalSlots.reduce((acc, s) => acc + slotDurationMin(s), 0) / 60;

    const alerts = getAlerts(user, ws, we, weekSlots);
    const pct = Math.min((weekHours / user.maxHours) * 100, 100);
    const barColor = weekHours > user.maxHours ? 'var(--danger)' : weekHours > user.maxHours * 0.85 ? 'var(--warning)' : 'var(--success)';

    html += `<div class="user-card">
      <div class="user-card-header">
        <div class="user-avatar user-drag-handle" style="background:${user.color}" data-user-id="${user.id}" title="Glisser vers le planning">${userInitials(user.name)}</div>
        <div class="user-card-name">${escapeHtml(user.name)}</div>
        <span class="user-drag-hint" title="Glisser pour créer/assigner un créneau">⠿</span>
      </div>
      <div class="user-stat"><span>Semaine</span><span>${weekHours.toFixed(1)}h / ${user.maxHours}h</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
      <div class="user-stat"><span>Total</span><span>${totalHours.toFixed(1)}h (${totalSlots.length} créneaux)</span></div>`;

    if (alerts.length > 0) {
      html += `<div class="alert-list">` + alerts.map(a =>
        `<div class="alert-item alert-${a.type}">${a.msg}</div>`
      ).join('') + `</div>`;
    }

    html += `</div>`;
  });

  container.innerHTML = html;
}

function getAlerts(user, weekStart, weekEnd, weekSlots) {
  const alerts = [];
  const weekMin = weekSlots.reduce((acc, s) => acc + slotDurationMin(s), 0);
  const weekHours = weekMin / 60;

  if (weekHours > user.maxHours) {
    alerts.push({ type: 'danger', msg: `⚠️ Dépassement : ${weekHours.toFixed(1)}h/${user.maxHours}h` });
  } else if (weekHours > user.maxHours * 0.9) {
    alerts.push({ type: 'warning', msg: `⚡ Proche limite : ${weekHours.toFixed(1)}h/${user.maxHours}h` });
  }

  // Check daily limits
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dayStr = formatDate(day);
    const daySlots = weekSlots.filter(s => s.date === dayStr);
    const dayMin = daySlots.reduce((acc, s) => acc + slotDurationMin(s), 0);
    const dayHours = dayMin / 60;
    if (dayHours > user.maxDaily) {
      alerts.push({ type: 'danger', msg: `⚠️ ${DAY_NAMES[day.getDay()]} : ${dayHours.toFixed(1)}h/${user.maxDaily}h` });
    }
  }

  // Check daily rest (11h minimum between end of one day and start of next)
  const slotsByDay = {};
  weekSlots.forEach(s => {
    if (!slotsByDay[s.date]) slotsByDay[s.date] = [];
    slotsByDay[s.date].push(s);
  });

  const dates = Object.keys(slotsByDay).sort();
  for (let di = 0; di < dates.length - 1; di++) {
    const d1 = dates[di];
    const d2 = dates[di + 1];
    // Check they're consecutive days
    const date1 = parseDate(d1);
    const date2 = parseDate(d2);
    const diff = (date2 - date1) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      const lastEnd = Math.max(...slotsByDay[d1].map(s => timeToMin(s.end)));
      const firstStart = Math.min(...slotsByDay[d2].map(s => timeToMin(s.start)));
      const restMin = (24 * 60 - lastEnd) + firstStart;
      const restHours = restMin / 60;
      if (restHours < user.restHours) {
        alerts.push({ type: 'warning', msg: `😴 Repos insuffisant : ${restHours.toFixed(1)}h/${user.restHours}h (${d1}→${d2})` });
      }
    }
  }

  return alerts;
}

/* =====================
   Auto-fill
   ===================== */
function autoFillWeek() {
  showModal('autofill-modal');
}

function confirmAutoFill() {
  const afStart = document.getElementById('af-start').value;
  const afEnd = document.getElementById('af-end').value;
  const duration = Number(document.getElementById('af-duration').value);
  const title = document.getElementById('af-title').value.trim() || 'Disponible';

  const checkedDays = Array.from(document.querySelectorAll('#af-days input:checked')).map(cb => Number(cb.value));

  if (!afStart || !afEnd || duration < 15) {
    showToast('Paramètres invalides', 'error');
    return;
  }
  if (timeToMin(afEnd) <= timeToMin(afStart)) {
    showToast("L'heure de fin doit être après l'heure de début", 'error');
    return;
  }

  const ws = getWeekStart(state.currentDate);
  let added = 0;

  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i);
    if (!checkedDays.includes(day.getDay())) continue;
    const dateStr = formatDate(day);

    // Find occupied intervals
    const existing = state.slots.filter(s => s.date === dateStr).map(s => ({ start: timeToMin(s.start), end: timeToMin(s.end) }));
    existing.sort((a, b) => a.start - b.start);

    let cursor = timeToMin(afStart);
    const endMin = timeToMin(afEnd);

    while (cursor + duration <= endMin) {
      const slotEnd = cursor + duration;
      // Check if free
      const conflict = existing.some(e => cursor < e.end && slotEnd > e.start);
      if (!conflict) {
        state.slots.push({
          id: uid(),
          title,
          date: dateStr,
          start: minToTime(cursor),
          end: minToTime(slotEnd),
          color: '#94a3b8',
          notes: '',
          userIds: [],
        });
        added++;
        existing.push({ start: cursor, end: slotEnd });
        existing.sort((a, b) => a.start - b.start);
      }
      cursor += duration;
    }
  }

  saveData();
  closeAllModals();
  renderAll();
  showToast(`${added} créneau(x) ajouté(s)`);
}

/* =====================
   Modal helpers
   ===================== */
function showModal(id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function closeAllModals() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) {
    // If confirm modal is open, treat overlay click as "cancel"
    if (!document.getElementById('confirm-modal').classList.contains('hidden')) {
      resolveConfirm(false);
    } else {
      closeAllModals();
    }
  }
}

/* =====================
   Toast notifications
   ===================== */
function showToast(msg, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: type === 'error' ? 'var(--danger)' : '#323232',
    color: 'white', padding: '10px 20px', borderRadius: '6px',
    boxShadow: 'var(--shadow-lg)', zIndex: '9999', fontSize: '13px',
    animation: 'none', transition: 'opacity 0.3s',
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

/* =====================
   Utilities
   ===================== */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

function userInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}

/* =====================
   Render all
   ===================== */
function renderCalendar() {
  updatePeriodLabel();
  if (state.view === 'week') {
    renderWeekView();
  } else {
    renderMonthView();
  }
  renderDashboard();
}

function renderAll() {
  renderCalendar();
}

/* =====================
   Init
   ===================== */
function init() {
  loadData();
  renderAll();

  // Update current time line every minute
  currentTimeInterval = setInterval(() => {
    if (state.view === 'week') renderWeekView();
  }, 60000);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.getElementById('confirm-modal').classList.contains('hidden')) {
        resolveConfirm(false);
      } else {
        closeAllModals();
      }
    }

    // Delete held slot: maintenir le clic sur un créneau + appuyer sur Suppr
    if ((e.key === 'Delete' || e.key === 'Backspace') && dragState && dragState.slot) {
      e.preventDefault();
      const slotToDelete = dragState.slot;
      if (cancelDrag) cancelDrag();
      state.slots = state.slots.filter(s => s.id !== slotToDelete.id);
      saveData();
      renderAll();
      showToast('Créneau supprimé');
    }
  });

  // Delegated drag handler for user avatars in the dashboard panel
  document.getElementById('dashboard-content').addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.user-drag-handle, .user-drag-hint');
    if (!handle) return;
    const card = handle.closest('[data-user-id]') || handle;
    const userId = card.dataset.userId || handle.closest('.user-card')?.querySelector('[data-user-id]')?.dataset.userId;
    if (!userId) return;
    const user = state.users.find(u => u.id === userId);
    if (user) startUserDrag(e, user);
  });
}

init();
