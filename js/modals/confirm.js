import { showModal, closeAllModals } from './modal.js';

let _resolve = null;

export function showConfirm(
  message,
  title = 'Confirmation',
  okLabel = 'Supprimer',
  okClass = 'btn-danger',
) {
  return new Promise((resolve) => {
    _resolve = resolve;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    const okBtn = document.getElementById('confirm-modal-ok');
    okBtn.textContent = okLabel;
    okBtn.className = `btn ${okClass}`;
    showModal('confirm-modal');
  });
}

export function resolveConfirm(result) {
  closeAllModals();
  if (_resolve) {
    _resolve(result);
    _resolve = null;
  }
}

export function isConfirmOpen() {
  return !document.getElementById('confirm-modal').classList.contains('hidden');
}
