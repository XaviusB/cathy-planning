import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { showModal, closeAllModals } from './modal.js';
import { showConfirm } from './confirm.js';
import { uid, escapeHtml, showToast, effectiveSlotColor } from '../utils/dom.js';
import { formatDate, timeToMin } from '../utils/date.js';

export let editingSlotId = null;

// Keeps track of the current single-select change handler so we can remove it on re-open
let _userSelectHandler = null;

export function openSlotModal(slotId, defaultDate, defaultStart, defaultEnd, defaultUserIds) {
  editingSlotId = slotId || null;

  const titleEl = document.getElementById('slot-modal-title');
  const deleteBtn = document.getElementById('slot-delete-btn');
  const multiToggle = document.getElementById('slot-multi-user');

  const cbContainer = document.getElementById('slot-users-checkboxes');
  cbContainer.innerHTML = state.users
    .map(
      (u) => `<label>
      <input type="checkbox" value="${u.id}" />
      <span class="slot-user-dot" style="background:${u.color}"></span>
      ${escapeHtml(u.name)}
    </label>`,
    )
    .join('');

  // Attach single-select handler (remove previous one first)
  if (_userSelectHandler) cbContainer.removeEventListener('change', _userSelectHandler);
  _userSelectHandler = (e) => {
    if (e.target.type !== 'checkbox') return;
    if (!multiToggle.checked && e.target.checked) {
      cbContainer.querySelectorAll('input[type=checkbox]').forEach((cb) => {
        if (cb !== e.target) cb.checked = false;
      });
    }
  };
  cbContainer.addEventListener('change', _userSelectHandler);

  if (slotId) {
    const slot = state.slots.find((s) => s.id === slotId);
    if (!slot) return;
    titleEl.textContent = 'Modifier le créneau';
    deleteBtn.style.display = '';
    document.getElementById('slot-title').value = slot.title || '';
    document.getElementById('slot-date').value = slot.date;
    document.getElementById('slot-start').value = slot.start;
    document.getElementById('slot-end').value = slot.end;
    document.getElementById('slot-notes').value = slot.notes || '';
    const isMulti = (slot.userIds || []).length > 1;
    multiToggle.checked = isMulti;
    (slot.userIds || []).forEach((id) => {
      const cb = cbContainer.querySelector(`input[value="${id}"]`);
      if (cb) cb.checked = true;
    });
  } else {
    titleEl.textContent = 'Nouveau créneau';
    deleteBtn.style.display = 'none';
    document.getElementById('slot-title').value = '';
    document.getElementById('slot-date').value = defaultDate || formatDate(state.currentDate);
    document.getElementById('slot-start').value = defaultStart || '08:00';
    document.getElementById('slot-end').value = defaultEnd || '12:00';
    document.getElementById('slot-notes').value = '';
    multiToggle.checked = false;
    if (defaultUserIds?.length) {
      defaultUserIds.forEach((id) => {
        const cb = cbContainer.querySelector(`input[value="${id}"]`);
        if (cb) cb.checked = true;
      });
    }
  }

  showModal('slot-modal');
}

export function saveSlot() {
  const title = document.getElementById('slot-title').value.trim();
  const date = document.getElementById('slot-date').value;
  const start = document.getElementById('slot-start').value;
  const end = document.getElementById('slot-end').value;
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
    document.querySelectorAll('#slot-users-checkboxes input:checked'),
  ).map((cb) => cb.value);

  // Color is always derived from the first assigned user
  const firstUser = userIds.length > 0 ? state.users.find((u) => u.id === userIds[0]) : null;
  const color = firstUser ? firstUser.color : '#94a3b8';

  if (editingSlotId) {
    const idx = state.slots.findIndex((s) => s.id === editingSlotId);
    if (idx >= 0) Object.assign(state.slots[idx], { title, date, start, end, color, notes, userIds });
  } else {
    state.slots.push({ id: uid(), title, date, start, end, color, notes, userIds });
  }

  saveData();
  closeAllModals();
  renderAll();
  showToast('Créneau enregistré');
}

export async function deleteSlot() {
  if (!editingSlotId) return;
  const ok = await showConfirm('Supprimer ce créneau ?');
  if (!ok) return;
  state.slots = state.slots.filter((s) => s.id !== editingSlotId);
  saveData();
  closeAllModals();
  renderAll();
  showToast('Créneau supprimé');
}
