import { state } from '../state.js';
import { addDays, formatDate, sameDay } from '../utils/date.js';
import { escapeHtml, getContrastColor } from '../utils/dom.js';
import { openSlotModal } from '../modals/slot-modal.js';

export function renderMonthView() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();

  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const container = document.getElementById('month-view');

  let html = `<div class="month-header-row">`;
  ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(
    (d) => (html += `<div class="month-header-cell">${d}</div>`),
  );
  html += '</div><div class="month-grid">';

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(addDays(firstDay, -(startDay - i)));
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) for (let i = 1; i <= remaining; i++) cells.push(addDays(lastDay, i));

  const MAX_SHOW = 3;
  cells.forEach((cellDate) => {
    const dateStr = formatDate(cellDate);
    const isToday = sameDay(cellDate, today);
    const isOther = cellDate.getMonth() !== month;
    const daySlots = state.slots.filter((s) => s.date === dateStr);

    html += `<div class="month-cell${isToday ? ' today' : ''}${isOther ? ' other-month' : ''}" data-date="${dateStr}" onclick="handleMonthCellClick(event,'${dateStr}')">`;
    html += `<div class="month-day-num">${cellDate.getDate()}</div>`;
    daySlots.slice(0, MAX_SHOW).forEach((slot) => {
      html += `<span class="month-slot-pill"
        style="background:${slot.color || '#4f86f7'};color:${getContrastColor(slot.color || '#4f86f7')}"
        onclick="event.stopPropagation();openSlotModal('${slot.id}')">${escapeHtml(slot.title || 'Créneau')}</span>`;
    });
    if (daySlots.length > MAX_SHOW) {
      html += `<div class="month-more">+${daySlots.length - MAX_SHOW} autres</div>`;
    }
    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

export function handleMonthCellClick(event, dateStr) {
  openSlotModal(null, dateStr);
}
