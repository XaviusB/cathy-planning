import { state } from './state.js';
import { MONTH_NAMES, DAY_NAMES } from './constants.js';
import { getWeekStart, addDays, formatDate, slotDurationMin } from './utils/date.js';
import { showToast } from './utils/dom.js';

const JSPDF_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

let jsPdfLoadPromise = null;

/**
 * Charge dynamiquement la librairie jsPDF depuis un CDN (une seule fois).
 */
function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (jsPdfLoadPromise) return jsPdfLoadPromise;

  jsPdfLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = JSPDF_CDN_URL;
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => reject(new Error('Impossible de charger jsPDF'));
    document.head.appendChild(script);
  });

  return jsPdfLoadPromise;
}

/**
 * Exporte un PDF par utilisateur pour la semaine actuellement affichée.
 */
export async function exportWeekPdf() {
  if (state.users.length === 0) {
    showToast('Aucun utilisateur à exporter', 'error');
    return;
  }

  let JsPDF;
  try {
    JsPDF = await loadJsPdf();
  } catch (e) {
    console.error(e);
    showToast('Échec du chargement du générateur PDF', 'error');
    return;
  }

  const ws = getWeekStart(state.currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const wsStr = formatDate(days[0]);
  const weStr = formatDate(days[6]);
  const periodLabel = `Semaine du ${days[0].getDate()} ${MONTH_NAMES[days[0].getMonth()]} au ${days[6].getDate()} ${MONTH_NAMES[days[6].getMonth()]} ${days[6].getFullYear()}`;

  state.users.forEach((user) => {
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    buildUserWeekPdf(doc, user, days, wsStr, weStr, periodLabel);
    doc.save(`planning-${slugify(user.name)}-${wsStr}.pdf`);
  });

  showToast(`${state.users.length} PDF exporté(s)`);
}

function buildUserWeekPdf(doc, user, days, wsStr, weStr, periodLabel) {
  const marginX = 15;
  let y = 20;

  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(`Planning — ${user.name}`, marginX, y);

  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(periodLabel, marginX, y);

  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, y, 195, y);
  y += 8;

  const userSlots = days.map((day) => {
    const dateStr = formatDate(day);
    const slots = state.slots
      .filter((s) => s.date === dateStr && (s.userIds || []).includes(user.id))
      .sort((a, b) => a.start.localeCompare(b.start));
    return { day, dateStr, slots };
  });

  let totalMinutes = 0;

  userSlots.forEach(({ day, slots }) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.setFont(undefined, 'bold');
    doc.text(`${DAY_NAMES[day.getDay()]} ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}`, marginX, y);
    doc.setFont(undefined, 'normal');
    y += 6;

    if (slots.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('— Aucun créneau —', marginX + 4, y);
      y += 7;
    } else {
      slots.forEach((slot) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        totalMinutes += slotDurationMin(slot);

        doc.setFontSize(10.5);
        doc.setTextColor(30, 30, 30);
        doc.text(`${slot.start} – ${slot.end}`, marginX + 4, y);
        doc.text(slot.title || 'Créneau', marginX + 32, y);

        if (slot.notes) {
          y += 5;
          doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          const noteLines = doc.splitTextToSize(slot.notes, 150);
          doc.text(noteLines, marginX + 32, y);
          y += (noteLines.length - 1) * 4;
        }
        y += 6;
      });
    }
    y += 2;
  });

  y += 4;
  if (y > 275) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(200, 200, 200);
  doc.line(marginX, y, 195, y);
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.setFont(undefined, 'bold');
  doc.text(`Total : ${(totalMinutes / 60).toFixed(1)} h / ${user.maxHours} h`, marginX, y);
  doc.setFont(undefined, 'normal');
}

function slugify(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
