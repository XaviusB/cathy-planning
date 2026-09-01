import { state } from '../state.js';
import { HOUR_START, HOUR_END, DAY_NAMES_SHORT } from '../constants.js';
import { getWeekStart, addDays, formatDate, sameDay, timeToMin } from '../utils/date.js';
import { escapeHtml, getContrastColor, effectiveSlotColor, slotBackground } from '../utils/dom.js';
import { openSlotModal } from '../modals/slot-modal.js';
import { startDrag } from '../drag/slot-drag.js';
import { startGridDraw } from '../drag/grid-draw.js';

export function renderWeekView() {
  const ws = getWeekStart(state.currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const today = new Date();
  const container = document.getElementById('week-view');

  container.innerHTML = _buildHeaderHtml(days, today) + _buildBodyHtml(days);

  _renderSlots(days);

  if (days.some((d) => sameDay(d, today))) {
    _renderCurrentTimeLine(days, today);
  }

  _setupDropZones();
}

function _buildHeaderHtml(days, today) {
  let html = `<div class="week-header-row" style="grid-template-columns:var(--time-col-width) repeat(7, 1fr)">`;
  html += `<div class="week-time-header"></div>`;
  days.forEach((day) => {
    const isToday = sameDay(day, today);
    html += `<div class="week-day-header${isToday ? ' today' : ''}" onclick="openSlotModal(null,'${formatDate(day)}')">
      <span style="font-size:11px">${DAY_NAMES_SHORT[day.getDay()]}</span>
      <span class="day-num">${day.getDate()}</span>
    </div>`;
  });
  html += '</div>';
  return html;
}

function _buildBodyHtml(days) {
  let html = `<div class="week-body">`;

  html += `<div class="week-time-col">`;
  for (let h = HOUR_START; h < HOUR_END; h++) {
    html += `<div class="hour-label">${h > 0 ? String(h).padStart(2, '0') + 'h' : ''}</div>`;
  }
  html += '</div>';

  html += `<div class="week-days-grid" id="week-days-grid" style="grid-template-columns:repeat(7,1fr)">`;
  days.forEach((day) => {
    const dateStr = formatDate(day);
    html += `<div class="week-day-col" data-date="${dateStr}">`;
    for (let h = HOUR_START; h < HOUR_END; h++) {
      html += `<div class="week-hour-cell" data-date="${dateStr}" data-hour="${h}"></div>`;
    }
    html += '</div>';
  });
  html += '</div></div>';

  return html;
}

function _renderSlots(days) {
  const grid = document.getElementById('week-days-grid');
  if (!grid) return;
  const cols = grid.querySelectorAll('.week-day-col');
  const wsStr = formatDate(days[0]);
  const weStr = formatDate(days[6]);

  state.slots
    .filter((s) => s.date >= wsStr && s.date <= weStr)
    .forEach((slot) => {
      const dayIdx = days.findIndex((d) => formatDate(d) === slot.date);
      if (dayIdx < 0) return;
      const col = cols[dayIdx];
      if (!col) return;

      const totalMin = (HOUR_END - HOUR_START) * 60;
      const startMin = timeToMin(slot.start) - HOUR_START * 60;
      const endMin = timeToMin(slot.end) - HOUR_START * 60;
      const top = (startMin / totalMin) * 100;
      const height = ((endMin - startMin) / totalMin) * 100;

      const el = document.createElement('div');
      el.className = 'slot-block';
      el.dataset.slotId = slot.id;
      el.style.top = `${top}%`;
      el.style.height = `${Math.max(height, 1.2)}%`;

      const assignedUsers = (slot.userIds || [])
        .map((id) => state.users.find((u) => u.id === id))
        .filter(Boolean);

      // Primary color used for text contrast; background may be a gradient
      const primaryColor = effectiveSlotColor(slot, state.users);
      el.style.background = slotBackground(slot, state.users);
      el.style.color = getContrastColor(primaryColor);
      el.style.borderLeftColor = primaryColor;
      const userDots = assignedUsers
        .map((u) => `<span class="slot-user-dot" style="background:${u.color}" title="${u.name}"></span>`)
        .join('');
      const userNames = assignedUsers.map((u) => u.name).join(', ');

      el.innerHTML = `
        <div class="slot-title">${escapeHtml(slot.title || 'Créneau')}</div>
        <div class="slot-time">${slot.start}–${slot.end}</div>
        ${assignedUsers.length ? `<div class="slot-users">${userDots} ${escapeHtml(userNames)}</div>` : ''}
      `;

      el.addEventListener('click', (ev) => { ev.stopPropagation(); openSlotModal(slot.id); });
      el.addEventListener('mousedown', (ev) => startDrag(ev, slot));
      col.appendChild(el);
    });
}

function _renderCurrentTimeLine(days, today) {
  const grid = document.getElementById('week-days-grid');
  if (!grid) return;
  const cols = grid.querySelectorAll('.week-day-col');
  const dayIdx = days.findIndex((d) => sameDay(d, today));
  if (dayIdx < 0) return;
  const nowMin = today.getHours() * 60 + today.getMinutes() - HOUR_START * 60;
  const top = (nowMin / ((HOUR_END - HOUR_START) * 60)) * 100;
  const line = document.createElement('div');
  line.className = 'current-time-line';
  line.style.top = `${top}%`;
  cols[dayIdx].appendChild(line);
}

function _setupDropZones() {
  const grid = document.getElementById('week-days-grid');
  if (!grid) return;
  grid.querySelectorAll('.week-day-col').forEach((col) => {
    col.addEventListener('mousedown', (e) => startGridDraw(e, col));
  });
}
