import { state, saveData, getActiveUsers } from '../state.js';
import { renderAll } from '../renderer.js';
import { showModal } from './modal.js';
import { showConfirm } from './confirm.js';
import { uid, escapeHtml, userAvatarContent, showToast } from '../utils/dom.js';
import { renderDashboard } from '../dashboard.js';

export let editingUserId = null;

let photoValue = null;
let photoImage = null;
let photoLoading = false;
let photoZoom = 1;
let photoBaseScale = 1;
let photoOffset = { x: 0, y: 0 };
let photoDrag = null;
let photoLoadId = 0;
let photoEditorBound = false;

export function openUsersModal() {
  ensurePhotoEditorBound();
  editingUserId = null;
  renderUsersList();
  clearUserForm();
  document.getElementById('user-cancel-edit-btn').style.display = 'none';
  document.getElementById('user-form-title').textContent = 'Ajouter un utilisateur';
  showModal('users-modal');
}

export function renderUsersList() {
  const container = document.getElementById('users-list');
  const activeUsers = getActiveUsers();
  if (activeUsers.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-muted);font-size:13px">Aucun utilisateur</p>';
    return;
  }
  container.innerHTML = activeUsers
    .map(
      (u) => `
    <div class="user-row">
      <div class="user-avatar" style="background:${u.color}">${userAvatarContent(u)}</div>
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
  setPhotoSource(user.photo || null);
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
  clearPhotoSource();
}

export function saveUser() {
  const name = document.getElementById('user-name').value.trim();
  if (!name) {
    showToast('Le nom est requis', 'error');
    return;
  }
  if (photoLoading) {
    showToast('La photo est encore en cours de chargement', 'error');
    return;
  }

  const data = {
    name,
    color: document.getElementById('user-color').value,
    maxHours: Number(document.getElementById('user-max-hours').value),
    restHours: Number(document.getElementById('user-rest-hours').value),
    maxDaily: Number(document.getElementById('user-max-daily').value),
    photo: photoImage ? createCroppedPhoto() : photoValue,
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
    "Supprimer cet utilisateur ? Ses assignations seront conservées et son nom sera barré.",
    "Supprimer l'utilisateur",
  );
  if (!ok) return;
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  user.deleted = true;
  user.deletedAt = new Date().toISOString();
  saveData();
  renderUsersList();
  renderAll();
  showToast('Utilisateur supprimé, ses assignations sont conservées');
}

function ensurePhotoEditorBound() {
  if (photoEditorBound) return;

  const fileInput = document.getElementById('user-photo-file');
  const cropper = document.getElementById('user-photo-cropper');
  if (!fileInput || !cropper) return;

  photoEditorBound = true;
  fileInput.addEventListener('change', handlePhotoFile);
  document.getElementById('user-photo-zoom').addEventListener('input', (event) => {
    setPhotoZoom(Number(event.target.value));
  });
  document.getElementById('user-photo-zoom-out').addEventListener('click', () => {
    setPhotoZoom(photoZoom - 0.1);
  });
  document.getElementById('user-photo-zoom-in').addEventListener('click', () => {
    setPhotoZoom(photoZoom + 0.1);
  });
  document.getElementById('user-photo-remove').addEventListener('click', clearPhotoSource);

  cropper.addEventListener('pointerdown', startPhotoPan);
  cropper.addEventListener('pointermove', movePhotoPan);
  cropper.addEventListener('pointerup', endPhotoPan);
  cropper.addEventListener('pointercancel', endPhotoPan);
}

function handlePhotoFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    event.target.value = '';
    showToast('Veuillez sélectionner une image', 'error');
    return;
  }

  const loadId = ++photoLoadId;
  photoLoading = true;
  photoImage = null;
  renderPhotoEditor();

  const reader = new FileReader();
  reader.onload = () => {
    if (loadId !== photoLoadId) return;
    if (typeof reader.result !== 'string') {
      photoLoading = false;
      renderPhotoEditor();
      showToast('Impossible de lire cette image', 'error');
      return;
    }
    loadPhotoSource(reader.result, loadId);
  };
  reader.onerror = () => {
    if (loadId !== photoLoadId) return;
    photoLoading = false;
    renderPhotoEditor();
    showToast('Impossible de lire cette image', 'error');
  };
  reader.readAsDataURL(file);
}

function loadPhotoSource(source, loadId) {
  const image = new Image();
  image.onload = () => {
    if (loadId !== photoLoadId) return;
    photoValue = source;
    photoImage = image;
    photoLoading = false;
    resetPhotoTransform();
  };
  image.onerror = () => {
    if (loadId !== photoLoadId) return;
    photoLoading = false;
    photoImage = null;
    renderPhotoEditor();
    showToast('Impossible de charger cette image', 'error');
  };
  image.src = source;
}

function setPhotoSource(source) {
  const loadId = ++photoLoadId;
  photoValue = source;
  photoImage = null;
  photoLoading = Boolean(source);
  photoOffset = { x: 0, y: 0 };
  renderPhotoEditor();
  if (source) loadPhotoSource(source, loadId);
}

function clearPhotoSource() {
  photoLoadId += 1;
  photoValue = null;
  photoImage = null;
  photoLoading = false;
  photoOffset = { x: 0, y: 0 };
  document.getElementById('user-photo-file').value = '';
  renderPhotoEditor();
}

function resetPhotoTransform() {
  const cropper = document.getElementById('user-photo-cropper');
  const width = cropper.clientWidth || 220;
  const height = cropper.clientHeight || 220;
  photoBaseScale = Math.max(
    width / photoImage.naturalWidth,
    height / photoImage.naturalHeight,
  );
  photoZoom = 1;
  photoOffset = { x: 0, y: 0 };
  document.getElementById('user-photo-zoom').value = '1';
  renderPhotoEditor();
}

function setPhotoZoom(value) {
  photoZoom = Math.max(1, Math.min(3, value));
  document.getElementById('user-photo-zoom').value = String(photoZoom);
  applyPhotoTransform();
}

function startPhotoPan(event) {
  if (!photoImage || event.button !== 0) return;
  photoDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: photoOffset.x,
    offsetY: photoOffset.y,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add('is-dragging');
  event.preventDefault();
}

function movePhotoPan(event) {
  if (!photoDrag || event.pointerId !== photoDrag.pointerId) return;
  photoOffset = {
    x: photoDrag.offsetX + event.clientX - photoDrag.startX,
    y: photoDrag.offsetY + event.clientY - photoDrag.startY,
  };
  applyPhotoTransform();
}

function endPhotoPan(event) {
  if (!photoDrag || event.pointerId !== photoDrag.pointerId) return;
  photoDrag = null;
  event.currentTarget.classList.remove('is-dragging');
}

function applyPhotoTransform() {
  if (!photoImage) return;
  const cropper = document.getElementById('user-photo-cropper');
  const imageElement = document.getElementById('user-photo-image');
  const size = cropper.clientWidth || 220;
  const scale = photoBaseScale * photoZoom;
  const maxOffsetX = Math.max(0, (photoImage.naturalWidth * scale - size) / 2);
  const maxOffsetY = Math.max(0, (photoImage.naturalHeight * scale - size) / 2);

  photoOffset.x = Math.max(-maxOffsetX, Math.min(maxOffsetX, photoOffset.x));
  photoOffset.y = Math.max(-maxOffsetY, Math.min(maxOffsetY, photoOffset.y));
  imageElement.style.transform =
    `translate(calc(-50% + ${photoOffset.x}px), calc(-50% + ${photoOffset.y}px)) scale(${scale})`;
  renderPhotoPreview();
}

function renderPhotoPreview() {
  const canvas = document.getElementById('user-photo-preview');
  if (!canvas || !photoImage) return;
  drawPhotoCrop(canvas);
}

function drawPhotoCrop(canvas) {
  const cropper = document.getElementById('user-photo-cropper');
  const size = cropper.clientWidth || 220;
  const scale = photoBaseScale * photoZoom;
  const sourceWidth = size / scale;
  const sourceHeight = size / scale;
  const sourceCenterX = photoImage.naturalWidth / 2 - photoOffset.x / scale;
  const sourceCenterY = photoImage.naturalHeight / 2 - photoOffset.y / scale;
  const sourceX = Math.max(0, Math.min(photoImage.naturalWidth - sourceWidth, sourceCenterX - sourceWidth / 2));
  const sourceY = Math.max(0, Math.min(photoImage.naturalHeight - sourceHeight, sourceCenterY - sourceHeight / 2));
  const context = canvas.getContext('2d');
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    photoImage,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

function createCroppedPhoto() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  drawPhotoCrop(canvas);
  return canvas.toDataURL('image/jpeg', 0.88);
}

function renderPhotoEditor() {
  const editor = document.getElementById('user-photo-editor');
  const imageElement = document.getElementById('user-photo-image');
  const removeButton = document.getElementById('user-photo-remove');
  if (!editor || !imageElement || !removeButton) return;

  removeButton.style.display = photoValue ? '' : 'none';
  if (!photoImage) {
    editor.classList.add('hidden');
    return;
  }

  editor.classList.remove('hidden');
  imageElement.src = photoValue;
  applyPhotoTransform();
}
