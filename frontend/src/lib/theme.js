/** Read and persist only the browser-local presentation preference. */
const THEME_KEY = 'writespace_theme';

/**
 * Initialize presentation without repairing storage or consulting the OS.
 * Returns:
 *   The exact saved mode, or light when storage is absent, invalid or inaccessible.
 * @returns {'light'|'dark'}
 */
export function readTheme() {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Attempt to save a valid preference without interrupting the active view.
 * Args:
 *   theme: Selected presentation mode; invalid values are not persisted.
 * Notes:
 *   Storage access and quota failures never escape into the UI.
 * @param {'light'|'dark'} theme
 * @returns {void}
 */
export function writeTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The in-memory preference remains active; durability is best effort.
  }
}
