import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/** Artboards de Claude Design. */
export const ARTBOARDS = [
  { name: 'desktop', width: 1280, height: 1140 },
  { name: 'tablet', width: 820, height: 1929 },
  { name: 'mobile', width: 390, height: 1327 },
] as const;

export type Artboard = (typeof ARTBOARDS)[number];
export type Lang = 'es' | 'en';
export type Theme = 'light' | 'dark';

/** Export local de Claude Design; fuera de git porque contiene datos personales. */
export const REFERENCE_PATH = fileURLToPath(new URL('../../design/reference.html', import.meta.url));
/** Hoja "V2 · Dark" (abre en oscuro por defecto). */
export const REFERENCE_DARK_PATH = fileURLToPath(
  new URL('../../design/reference-dark.html', import.meta.url),
);
export const hasReference = existsSync(REFERENCE_PATH) && existsSync(REFERENCE_DARK_PATH);

/** Locale de navegador que hace que el diseño autodetecte cada idioma. */
export const LOCALE: Record<Lang, string> = { es: 'es-AR', en: 'en-US' };

/** Abre el diseño de referencia en el idioma/tema pedidos. El idioma sale del locale del contexto. */
export async function openReference(page: Page, theme: Theme): Promise<void> {
  await page.goto(`file://${theme === 'dark' ? REFERENCE_DARK_PATH : REFERENCE_PATH}`);
  // El bundle se desempaqueta en runtime: esperar al contenido real, no al loader.
  await page.locator('main.root').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

export async function screenshot(page: Page): Promise<Buffer> {
  return page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
}

export interface DiffResult {
  diffPixels: number;
  ratio: number;
  diffPng: Buffer;
  sizeMismatch: boolean;
}

/** Compara dos capturas; tamaños distintos cuentan como diferencia total (el layout no coincide). */
export function diffImages(actual: Buffer, expected: Buffer): DiffResult {
  const a = PNG.sync.read(actual);
  const e = PNG.sync.read(expected);
  if (a.width !== e.width || a.height !== e.height) {
    return { diffPixels: e.width * e.height, ratio: 1, diffPng: actual, sizeMismatch: true };
  }
  const diff = new PNG({ width: e.width, height: e.height });
  const diffPixels = pixelmatch(a.data, e.data, diff.data, e.width, e.height, { threshold: 0.1 });
  return {
    diffPixels,
    ratio: diffPixels / (e.width * e.height),
    diffPng: PNG.sync.write(diff),
    sizeMismatch: false,
  };
}

/** Umbral de aceptación de PLAN.md §3. */
export const MAX_DIFF_RATIO = 0.001;
