export type Theme = 'light' | 'dark';

/** Clave de localStorage; el script inline de BaseLayout la lee antes del primer paint. */
export const THEME_STORAGE_KEY = 'bento-theme';

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage bloqueado (modo privado estricto): el tema aplica solo a esta visita.
  }
}
