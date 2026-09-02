import { STORAGE_KEY } from './constants.js';
import { formatDate } from './utils/date.js';
import { showToast } from './utils/dom.js';
import { renderAll } from './renderer.js';

const DASHBOARD_RANGE_KEY = 'planning_dashboard_range_v1';

export const state = {
  users: [],
  slots: [],
  view: 'week',
  currentDate: new Date(),
  dashboardRange: null,
};

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.users) state.users = d.users;
      if (d.slots) state.slots = d.slots;
    }
  } catch (e) {
    console.warn('Failed to load data', e);
  }

  try {
    const rawRange = localStorage.getItem(DASHBOARD_RANGE_KEY);
    if (rawRange) {
      const r = JSON.parse(rawRange);
      if (r && r.start && r.end) state.dashboardRange = r;
    }
  } catch (e) {
    console.warn('Failed to load dashboard range', e);
  }
}

export function saveDashboardRange() {
  if (state.dashboardRange) {
    localStorage.setItem(DASHBOARD_RANGE_KEY, JSON.stringify(state.dashboardRange));
  } else {
    localStorage.removeItem(DASHBOARD_RANGE_KEY);
  }
}

export function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ users: state.users, slots: state.slots }));
}

export function exportData() {
  const json = JSON.stringify({ users: state.users, slots: state.slots }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planning-${formatDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(event) {
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
