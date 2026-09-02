import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { showModal } from './modal.js';
import { showConfirm } from './confirm.js';
import { uid, escapeHtml, userInitials, showToast } from '../utils/dom.js';
import { renderDashboard } from '../dashboard.js';

export let editingUserId = null;

export function openUsersModal() {
  editingUserId = null;
  renderUsersList();
  clearUserForm();
  document.getElementById('user-cancel-edit-btn').style.display = 'none';
  document.getElementById('user-form-title').textContent = 'Ajouter un utilisateur';
  showModal('users-modal');
}

export function renderUsersList() {
  const container = document.getElementById('users-list');
  if (state.users.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-muted);font-size:13px">Aucun utilisateur</p>';
    return;
  }
  container.innerHTML = state.users
    .map(
      (u) => `
    <div class="user-row">
      <div class="user-avatar" style="background:${u.color}">${userInitials(u.name)}</div>
      <div style="flex:1">
        <div class="user-row-name">${escapeHtml(u.name)}</div>
        <div class="user-row-rules">${u.maxHours}h/sem · repos ${u.restHours}h · max ${u.maxDaily}h/j</div>
      </div>
      <button class="icon-btn" onclick="editUser('${u.id}')" title="Modifier">✏️</button>
      <button class="icon-btn" onclick="removeUser('${u.id}')" title="Supprimer">🗑️</button>
    </div>`,
    )
    .join('');
}

export function editUser(userId) {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  editingUserId = userId;
  document.getElementById('user-name').value = user.name;
  document.getElementById('user-color').value = user.color;
  document.getElementById('user-max-hours').value = user.maxHours;
  document.getElementById('user-rest-hours').value = user.restHours;
  document.getElementById('user-max-daily').value = user.maxDaily;
  document.getElementById('user-form-title').textContent = "Modifier l'utilisateur";
  document.getElementById('user-cancel-edit-btn').style.display = '';
}

export function cancelEditUser() {
  editingUserId = null;
  clearUserForm();
  document.getElementById('user-form-title').textContent = 'Ajouter un utilisateur';
  document.getElementById('user-cancel-edit-btn').style.display = 'none';
}

export function clearUserForm() {
  document.getElementById('user-name').value = '';
  document.getElementById('user-color').value =
    '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  document.getElementById('user-max-hours').value = 35;
  document.getElementById('user-rest-hours').value = 11;
  document.getElementById('user-max-daily').value = 10;
}

export function saveUser() {
  const name = document.getElementById('user-name').value.trim();
  if (!name) {
    showToast('Le nom est requis', 'error');
    return;
  }

  const data = {
    name,
    color: document.getElementById('user-color').value,
    maxHours: Number(document.getElementById('user-max-hours').value),
    restHours: Number(document.getElementById('user-rest-hours').value),
    maxDaily: Number(document.getElementById('user-max-daily').value),
  };

  if (editingUserId) {
    const idx = state.users.findIndex((u) => u.id === editingUserId);
    if (idx >= 0) Object.assign(state.users[idx], data);
  } else {
    state.users.push({ id: uid(), ...data });
  }

  saveData();
  cancelEditUser();
  renderUsersList();
  renderDashboard();
  showToast('Utilisateur enregistré');
}

export async function removeUser(userId) {
  const ok = await showConfirm(
    "Supprimer cet utilisateur ? Ses assignations seront retirées.",
    "Supprimer l'utilisateur",
  );
  if (!ok) return;
  state.users = state.users.filter((u) => u.id !== userId);
  state.slots.forEach((s) => {
    s.userIds = (s.userIds || []).filter((id) => id !== userId);
  });
  saveData();
  renderUsersList();
  renderAll();
  showToast('Utilisateur supprimé');
}
