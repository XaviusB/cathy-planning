import { state } from '../state.js';
import { HOUR_START, HOUR_END, DAY_NAMES_SHORT } from '../constants.js';
import { formatDate, sameDay, timeToMin } from '../utils/date.js';
import { escapeHtml, getContrastColor, effectiveSlotColor, slotBackground } from '../utils/dom.js';
import { openSlotModal } from '../modals/slot-modal.js';

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
    const daySlots = state.slots.filter((s) => s.date === dateStr);

    html += `<div class="agenda-row${isToday ? ' today' : ''}">`;
    html += `<div class="agenda-day-label" onclick="handleMonthCellClick(event,'${dateStr}')">
      <span class="agenda-day-name">${DAY_NAMES_SHORT[cellDate.getDay()]}</span>
      <span class="agenda-day-num">${d}</span>
    </div>`;
    html += `<div class="agenda-track" data-date="${dateStr}" onclick="handleMonthCellClick(event,'${dateStr}')">`;

    for (let h = HOUR_START; h < HOUR_END; h++) {
      const left = ((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100;
      html += `<div class="agenda-hour-gridline" style="left:${left}%"></div>`;
    }

    daySlots.forEach((slot) => {
      const totalMin = (HOUR_END - HOUR_START) * 60;
      const startMin = timeToMin(slot.start) - HOUR_START * 60;
      const endMin = timeToMin(slot.end) - HOUR_START * 60;
      const left = (startMin / totalMin) * 100;
      const width = Math.max(((endMin - startMin) / totalMin) * 100, 0.8);

      const bg = slotBackground(slot, state.users);
      const textColor = getContrastColor(effectiveSlotColor(slot, state.users));
      html += `<div class="agenda-slot-pill"
        style="left:${left}%;width:${width}%;background:${bg};color:${textColor}"
        title="${escapeHtml(slot.title || 'Créneau')} (${slot.start}–${slot.end})"
        onclick="event.stopPropagation();openSlotModal('${slot.id}')">${escapeHtml(slot.title || 'Créneau')}</div>`;
    });

    html += `</div></div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  if (today.getFullYear() === year && today.getMonth() === month) {
    const todayRow = container.querySelector('.agenda-row.today');
    if (todayRow) todayRow.scrollIntoView({ block: 'center' });
  }
}

export function handleMonthCellClick(event, dateStr) {
  openSlotModal(null, dateStr);
}
