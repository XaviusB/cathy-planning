import { setRenderAll } from './renderer.js';
import { loadData, saveData, exportData, importData, resetData, state } from './state.js';
import { renderCalendar } from './calendar.js';
import { renderWeekView } from './views/week-view.js';
import { setView, navigate, goToToday, setDisplayMode, setDisplayUser } from './calendar.js';
import { openSlotModal, saveSlot, deleteSlot } from './modals/slot-modal.js';
import { openUsersModal, saveUser, cancelEditUser, editUser, removeUser } from './modals/user-modal.js';
import { autoFillWeek, confirmAutoFill } from './modals/autofill-modal.js';
import { showModal, closeAllModals } from './modals/modal.js';
import {
  openDateRangeModal,
  resetDateRangeSelection,
  navigateDateRangeMonths,
  selectDateRangeDay,
  applyDateRange,
} from './modals/date-range-modal.js';
import { clearDashboardRange } from './dashboard.js';
import { resolveConfirm, isConfirmOpen, showConfirm } from './modals/confirm.js';
import { dragState, cancelDrag } from './drag/slot-drag.js';
import { resizeState, cancelResize } from './drag/slot-resize.js';
import { startUserDrag } from './drag/user-drag.js';
import { handleMonthCellClick } from './views/month-view.js';
import { exportWeekPdf } from './export-pdf.js';
import { initTheme, setTheme, toggleMainMenu, closeMainMenu, toggleSubmenu } from './menu.js';
import { openSettingsModal, saveSettings, renderSettingsDays } from './modals/settings-modal.js';

// Wire the renderer so all modules can call renderAll() without circular deps
setRenderAll(renderCalendar);

// ─── Expose globals for HTML onclick handlers ────────────────────────────────
window.setView = setView;
window.navigate = navigate;
window.goToToday = goToToday;
window.setDisplayMode = setDisplayMode;
window.setDisplayUser = setDisplayUser;
window.openSlotModal = openSlotModal;
window.saveSlot = saveSlot;
window.deleteSlot = deleteSlot;
window.openUsersModal = openUsersModal;
window.saveUser = saveUser;
window.cancelEditUser = cancelEditUser;
window.editUser = editUser;
window.removeUser = removeUser;
window.autoFillWeek = autoFillWeek;
window.confirmAutoFill = confirmAutoFill;
window.exportData = exportData;
window.resetAllData = resetAllData;
window.exportWeekPdf = exportWeekPdf;
window.importData = importData;
window.closeAllModals = closeAllModals;
window.closeModal = closeModal;
window.resolveConfirm = resolveConfirm;
window.handleMonthCellClick = handleMonthCellClick;
window.openDateRangeModal = openDateRangeModal;
window.resetDateRangeSelection = resetDateRangeSelection;
window.navigateDateRangeMonths = navigateDateRangeMonths;
window.selectDateRangeDay = selectDateRangeDay;
window.applyDateRange = applyDateRange;
window.clearDashboardRange = clearDashboardRange;
window.setTheme = setTheme;
window.toggleMainMenu = toggleMainMenu;
window.closeMainMenu = closeMainMenu;
window.toggleSubmenu = toggleSubmenu;
window.openSettingsModal = openSettingsModal;
window.saveSettings = saveSettings;

async function resetAllData() {
  const confirmed = await showConfirm(
    'Cette action supprimera tous les utilisateurs et tous les créneaux, et réinitialisera la période du tableau de bord.',
    'Réinitialiser toutes les données',
    'Réinitialiser',
    'btn-danger',
  );
  if (confirmed) resetData();
}

// ─── Modal overlay click handler ─────────────────────────────────────────────
function closeModal(e) {
  if (e.target !== document.getElementById('modal-overlay')) return;
  if (isConfirmOpen()) {
    resolveConfirm(false);
  } else {
    closeAllModals();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  initTheme();
  renderSettingsDays();
  loadData();
  renderCalendar();

  // Refresh current-time line every minute
  setInterval(() => {
    if (state.view === 'week') renderWeekView();
  }, 60_000);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'Enter' &&
      e.ctrlKey &&
      !document.getElementById('slot-modal').classList.contains('hidden')
    ) {
      e.preventDefault();
      saveSlot();
      return;
    }

    if (e.key === 'Escape') {
      if (resizeState) {
        if (cancelResize) cancelResize();
      } else if (dragState) {
        if (cancelDrag) cancelDrag();
      } else if (isConfirmOpen()) {
        resolveConfirm(false);
      } else {
        closeMainMenu();
        closeAllModals();
      }
    }

    // Hold click on slot + Delete → delete the slot
    if ((e.key === 'Delete' || e.key === 'Backspace') && dragState?.slot) {
      e.preventDefault();
      const slotToDelete = dragState.slot;
      if (cancelDrag) cancelDrag();
      state.slots = state.slots.filter((s) => s.id !== slotToDelete.id);
      saveData();
      renderCalendar();
    }
  });

  // Delegated drag handler for user avatars in the dashboard panel
  document.getElementById('dashboard-content').addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.user-drag-handle, .user-drag-hint');
    if (!handle) return;
    const userId =
      handle.dataset.userId ||
      handle.closest('.user-card-header')?.querySelector('[data-user-id]')?.dataset.userId;
    if (!userId) return;
    const user = state.users.find((u) => u.id === userId);
    if (user) startUserDrag(e, user);
  });
}

init();
