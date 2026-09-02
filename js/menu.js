const THEME_KEY = 'planning_theme_v1';

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved === 'dark' ? 'dark' : 'light';
  applyTheme(theme);
}

export function setTheme(theme) {
  applyTheme(theme);
  localStorage.setItem(THEME_KEY, theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-item-light')?.classList.toggle('active', theme === 'light');
  document.getElementById('theme-item-dark')?.classList.toggle('active', theme === 'dark');
}

// ─── Dropdown menu handling ───────────────────────────────────────────────────
export function toggleMainMenu(e) {
  e.stopPropagation();
  const panel = document.getElementById('main-menu-panel');
  const willOpen = panel.classList.contains('hidden');
  closeMainMenu();
  if (willOpen) panel.classList.remove('hidden');
}

export function closeMainMenu() {
  document.getElementById('main-menu-panel').classList.add('hidden');
  document.querySelectorAll('.dropdown-submenu-panel').forEach((p) => p.classList.add('hidden'));
}

export function toggleSubmenu(e, id) {
  e.stopPropagation();
  const panel = document.getElementById(id);
  const willOpen = panel.classList.contains('hidden');
  document.querySelectorAll('.dropdown-submenu-panel').forEach((p) => p.classList.add('hidden'));
  if (willOpen) panel.classList.remove('hidden');
}

// Close the menu when clicking anywhere outside of it
document.addEventListener('click', (e) => {
  const menu = document.getElementById('main-menu');
  if (menu && !menu.contains(e.target)) closeMainMenu();
});
