import { state, isSlotVisible } from '../state.js';
import { HOUR_START, HOUR_END, DAY_NAMES_SHORT } from '../constants.js';
import { formatDate, sameDay, timeToMin } from '../utils/date.js';
import { escapeHtml, getContrastColor, effectiveSlotColor, slotBackground } from '../utils/dom.js';
import { openSlotModal } from '../modals/slot-modal.js';
import { startDrag } from '../drag/slot-drag.js';
import { startResize } from '../drag/slot-resize.js';
import { startGridDraw } from '../drag/grid-draw.js';
import { layoutOverlappingSlots } from '../utils/slot-layout.js';

// "Agenda" month view: one horizontal row per day of the month, each row showing
// a 0h–24h timeline with slots positioned/sized proportionally to their time —
// avoids a cramped ~31-column grid while still conveying schedule density at a glance.

export function renderMonthView() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();

  const container = document.getElementById('month-view');

  let html = `<div class="agenda-hour-ruler">
    <div class="agenda-label-spacer"></div>
    <div class="agenda-hour-ruler-track">`;
  for (let h = HOUR_START; h < HOUR_END; h++) {
    const left = ((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100;
    html += `<span class="agenda-hour-mark" style="left:${left}%">${h}h</span>`;
  }
  html += `</div></div><div class="agenda-days">`;

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const cellDate = new Date(year, month, d);
    const dateStr = formatDate(cellDate);
    const isToday = sameDay(cellDate, today);
    const isRestDay = state.settings.weeklyRestDays.includes(cellDate.getDay());
    const standardStart = (timeToMin(state.settings.standardStart) / ((HOUR_END - HOUR_START) * 60)) * 100;
    const standardWidth =
      ((timeToMin(state.settings.standardEnd) - timeToMin(state.settings.standardStart)) /
        ((HOUR_END - HOUR_START) * 60)) *
      100;

    html += `<div class="agenda-row${isToday ? ' today' : ''}">`;
    html += `<div class="agenda-day-label" onclick="handleMonthCellClick(event,'${dateStr}')">
      <span class="agenda-day-name">${DAY_NAMES_SHORT[cellDate.getDay()]}</span>
      <span class="agenda-day-num">${d}</span>
    </div>`;
    html += `<div class="agenda-track${isRestDay ? ' standard-rest-day' : ' standard-day'}" data-date="${dateStr}"
      style="--standard-start:${standardStart}%;--standard-width:${standardWidth}%;">`;

    for (let h = HOUR_START; h < HOUR_END; h++) {
      const left = ((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100;
      html += `<div class="agenda-hour-gridline" style="left:${left}%"></div>`;
    }

    html += `</div></div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  _renderSlots(year, month, lastDay.getDate());

  if (today.getFullYear() === year && today.getMonth() === month) {
    const todayRow = container.querySelector('.agenda-row.today');
    if (todayRow) todayRow.scrollIntoView({ block: 'center' });
  }
}

function _renderSlots(year, month, numDays) {
  const container = document.getElementById('month-view');
  const tracks = container.querySelectorAll('.agenda-track');

  for (let d = 1; d <= numDays; d++) {
    const dateStr = formatDate(new Date(year, month, d));
    const track = tracks[d - 1];
    if (!track) continue;

    const daySlots = state.slots.filter((s) => s.date === dateStr && isSlotVisible(s));
    const layouts = layoutOverlappingSlots(daySlots);
    if (state.displayMode === 'overlap') {
      const laneCount = layouts.values().next().value?.laneCount || 1;
      track.style.minHeight = `${Math.max(42, laneCount * 42)}px`;
    }
    const totalMin = (HOUR_END - HOUR_START) * 60;

    daySlots.forEach((slot) => {
      const startMin = timeToMin(slot.start) - HOUR_START * 60;
      const endMin = timeToMin(slot.end) - HOUR_START * 60;
      const left = (startMin / totalMin) * 100;
      const width = Math.max(((endMin - startMin) / totalMin) * 100, 0.8);

      const bg = slotBackground(slot, state.users);
      const textColor = getContrastColor(effectiveSlotColor(slot, state.users));

      const el = document.createElement('div');
      el.className = 'agenda-slot-pill';
      el.dataset.slotId = slot.id;
      el.style.left = `${left}%`;
      el.style.width = `${width}%`;
      el.style.background = bg;
      el.style.color = textColor;
      if (state.displayMode === 'overlap') {
        const layout = layouts.get(slot.id);
        el.style.top = `${(layout.lane / layout.laneCount) * 100}%`;
        el.style.bottom = 'auto';
        el.style.height = `${100 / layout.laneCount}%`;
      }
      el.title = `${slot.title || 'Créneau'} (${slot.start}–${slot.end})`;
      el.innerHTML = `
        <div class="slot-resize-handle slot-resize-left"></div>
        <span class="agenda-slot-title">${escapeHtml(slot.title || 'Créneau')}</span>
        <div class="slot-resize-handle slot-resize-right"></div>
      `;

      el.addEventListener('click', (ev) => { ev.stopPropagation(); openSlotModal(slot.id); });
      el.addEventListener('mousedown', (ev) => startDrag(ev, slot));
      el.querySelector('.slot-resize-left').addEventListener('mousedown', (ev) => startResize(ev, slot, 'left'));
      el.querySelector('.slot-resize-right').addEventListener('mousedown', (ev) => startResize(ev, slot, 'right'));
      track.appendChild(el);
    });

    track.addEventListener('mousedown', (e) => startGridDraw(e, track));
  }
}

export function handleMonthCellClick(event, dateStr) {
  openSlotModal(null, dateStr);
}
