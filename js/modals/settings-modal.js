import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { showModal, closeAllModals } from './modal.js';
import { showToast } from '../utils/dom.js';

const DAYS = [
  ['1', 'Lundi'],
  ['2', 'Mardi'],
  ['3', 'Mercredi'],
  ['4', 'Jeudi'],
  ['5', 'Vendredi'],
  ['6', 'Samedi'],
  ['0', 'Dimanche'],
];

export function openSettingsModal() {
  document.getElementById('settings-standard-start').value = state.settings.standardStart;
  document.getElementById('settings-standard-end').value = state.settings.standardEnd;
  document.getElementById('settings-weekly-hours').value = state.settings.standardWeeklyHours;
  const restDays = new Set(state.settings.weeklyRestDays);
  document.querySelectorAll('#settings-rest-days input').forEach((input) => {
    input.checked = restDays.has(Number(input.value));
  });
  showModal('settings-modal');
}

export function saveSettings() {
  const standardStart = document.getElementById('settings-standard-start').value;
  const standardEnd = document.getElementById('settings-standard-end').value;
  const standardWeeklyHours = Number(document.getElementById('settings-weekly-hours').value);
  const weeklyRestDays = Array.from(
    document.querySelectorAll('#settings-rest-days input:checked'),
  ).map((input) => Number(input.value));

  if (!standardStart || !standardEnd || standardEnd <= standardStart) {
    showToast("L'heure de fin doit être après l'heure de début", 'error');
    return;
  }
  if (!Number.isFinite(standardWeeklyHours) || standardWeeklyHours <= 0 || standardWeeklyHours > 168) {
    showToast("Le nombre d'heures hebdomadaires doit être compris entre 1 et 168", 'error');
    return;
  }

  state.settings = { standardStart, standardEnd, weeklyRestDays, standardWeeklyHours };
  saveData();
  closeAllModals();
  renderAll();
  showToast('Paramètres enregistrés');
}

export function renderSettingsDays() {
  document.getElementById('settings-rest-days').innerHTML = DAYS.map(
    ([value, label]) =>
      `<label><input type="checkbox" value="${value}" /> ${label}</label>`,
  ).join('');
}
