import { STORAGE_KEY } from './constants.js';
import { formatDate } from './utils/date.js';
import { showToast } from './utils/dom.js';
import { renderAll } from './renderer.js';

const DASHBOARD_RANGE_KEY = 'planning_dashboard_range_v1';
const VIEW_PREFERENCES_KEY = 'planning_view_preferences_v1';
export const DEFAULT_SETTINGS = {
  standardStart: '09:00',
  standardEnd: '17:00',
  weeklyRestDays: [0],
  weeklyRestHours: 35,
  standardWeeklyHours: 35,
};

export const state = {
  users: [],
  slots: [],
  view: 'week',
  currentDate: new Date(),
  dashboardRange: null,
  settings: { ...DEFAULT_SETTINGS },
  displayMode: 'overlap',
  displayUserId: null,
};

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.users) state.users = d.users;
      if (d.slots) state.slots = d.slots;
      if (d.settings) {
        state.settings = {
          ...DEFAULT_SETTINGS,
          ...d.settings,
          weeklyRestHours: Math.max(35, Number(d.settings.weeklyRestHours) || DEFAULT_SETTINGS.weeklyRestHours),
          weeklyRestDays: Array.isArray(d.settings.weeklyRestDays)
            ? d.settings.weeklyRestDays
            : DEFAULT_SETTINGS.weeklyRestDays,
        };
      }

      try {
        const rawPreferences = localStorage.getItem(VIEW_PREFERENCES_KEY);
        if (rawPreferences) {
          const preferences = JSON.parse(rawPreferences);
          if (preferences.view === 'week' || preferences.view === 'month') state.view = preferences.view;
          if (preferences.displayMode === 'overlap' || preferences.displayMode === 'user') {
            state.displayMode = preferences.displayMode;
          }
          if (typeof preferences.displayUserId === 'string') state.displayUserId = preferences.displayUserId;
          if (preferences.currentDate) {
            const date = new Date(preferences.currentDate);
            if (!Number.isNaN(date.getTime())) state.currentDate = date;
          }
        }
      } catch (e) {
        console.warn('Failed to load view preferences', e);
      }
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
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ users: state.users, slots: state.slots, settings: state.settings }),
  );
}

export function saveViewPreferences() {
  localStorage.setItem(
    VIEW_PREFERENCES_KEY,
    JSON.stringify({
      view: state.view,
      displayMode: state.displayMode,
      displayUserId: state.displayUserId,
      currentDate: state.currentDate.toISOString(),
    }),
  );
}

export function isSlotVisible(slot) {
  return state.displayMode !== 'user' || (slot.userIds || []).includes(state.displayUserId);
}

export function resetData() {
  state.users = [];
  state.slots = [];
  state.dashboardRange = null;
  state.settings = { ...DEFAULT_SETTINGS, weeklyRestDays: [...DEFAULT_SETTINGS.weeklyRestDays] };
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DASHBOARD_RANGE_KEY);
  renderAll();
  showToast('Toutes les données ont été réinitialisées');
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
