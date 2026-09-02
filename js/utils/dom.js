/**
 * Retourne la couleur principale d'un créneau (pour le contraste du texte).
 */
export function effectiveSlotColor(slot, users) {
  const firstUser = users.find((u) => (slot.userIds || []).includes(u.id));
  return firstUser ? firstUser.color : (slot.color || '#94a3b8');
}

/**
 * Retourne la valeur CSS `background` d'un créneau.
 * - 0 utilisateur : couleur neutre
 * - 1 utilisateur : couleur de l'utilisateur
 * - N utilisateurs : bandes verticales (une couleur par utilisateur)
 */
export function slotBackground(slot, users) {
  const assigned = (slot.userIds || [])
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean);

  if (assigned.length === 0) return slot.color || '#94a3b8';
  if (assigned.length === 1) return assigned[0].color;

  const pct = 100 / assigned.length;
  const stops = assigned.map((u, i) =>
    `${u.color} ${(i * pct).toFixed(2)}% ${((i + 1) * pct).toFixed(2)}%`
  );
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

export function userInitials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}

export function showToast(msg, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: type === 'error' ? 'var(--danger)' : '#323232',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '6px',
    boxShadow: 'var(--shadow-lg)',
    zIndex: '9999',
    fontSize: '13px',
    transition: 'opacity 0.3s',
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
