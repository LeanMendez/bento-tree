import { expect, test, type Page } from '@playwright/test';
import {
  ARTBOARDS,
  LOCALE,
  MAX_DIFF_RATIO,
  diffImages,
  hasReference,
  openReference,
  screenshot,
  type Lang,
  type Theme,
} from './harness';

const LANGS: Lang[] = ['es', 'en'];
const THEMES: Theme[] = ['light', 'dark'];
const PATH: Record<Lang, string> = { es: '/', en: '/en/' };
const TO_DARK: Record<Lang, string> = { es: 'Cambiar a modo oscuro', en: 'Switch to dark mode' };

test.skip(!hasReference, 'design/reference.html no está (export local de Claude Design)');

async function openApp(page: Page, lang: Lang, theme: Theme): Promise<void> {
  // Islands bloqueadas: se compara el fallback (= valores del diseño), no datos en vivo.
  await page.route('**/_server-islands/**', (route) => route.abort());
  await page.goto(PATH[lang]);
  await page.evaluate(() => document.fonts.ready);
  if (theme === 'dark') {
    await page.getByRole('button', { name: TO_DARK[lang] }).click();
    await page.mouse.move(0, 0);
  }
}

for (const board of ARTBOARDS) {
  for (const lang of LANGS) {
    for (const theme of THEMES) {
      test.describe(`${board.name} ${lang} ${theme}`, () => {
        test.use({
          viewport: { width: board.width, height: board.height },
          locale: LOCALE[lang],
          reducedMotion: 'reduce',
        });

        test('coincide con el diseño', async ({ page, browser }, testInfo) => {
          const refContext = await browser.newContext({
            viewport: { width: board.width, height: board.height },
            locale: LOCALE[lang],
            reducedMotion: 'reduce',
            deviceScaleFactor: 1,
          });
          const refPage = await refContext.newPage();
          await openReference(refPage, lang, theme);
          const expected = await screenshot(refPage);
          await refContext.close();

          await openApp(page, lang, theme);
          const actual = await screenshot(page);

          const result = diffImages(actual, expected);
          await testInfo.attach('expected.png', { body: expected, contentType: 'image/png' });
          await testInfo.attach('actual.png', { body: actual, contentType: 'image/png' });
          await testInfo.attach('diff.png', { body: result.diffPng, contentType: 'image/png' });

          expect(result.sizeMismatch, 'tamaño de página distinto al diseño').toBe(false);
          expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
        });
      });
    }
  }
}

/** Estados interactivos: se aplica la misma acción en diseño y app y se comparan las capturas. */
const STATES: { name: string; act: (page: Page, lang: Lang) => Promise<void> }[] = [
  ...(['code', 'social', 'content'] as const).map((filter) => ({
    name: `filtro ${filter}`,
    act: async (page: Page, lang: Lang) => {
      const labels = {
        es: { code: 'Código', social: 'Social', content: 'Contenido' },
        en: { code: 'Code', social: 'Social', content: 'Content' },
      };
      await page.getByRole('button', { name: labels[lang][filter], exact: true }).click();
      await page.mouse.move(0, 0);
    },
  })),
  {
    name: 'hover tile LinkedIn',
    act: async (page: Page) => {
      await page.getByRole('link', { name: /LinkedIn/ }).hover();
    },
  },
];

for (const board of [ARTBOARDS[0], ARTBOARDS[2]]) {
  for (const lang of LANGS) {
    for (const state of STATES) {
      test.describe(`${board.name} ${lang} ${state.name}`, () => {
        test.use({
          viewport: { width: board.width, height: board.height },
          locale: LOCALE[lang],
          reducedMotion: 'reduce',
        });

        test('coincide con el diseño', async ({ page, browser }) => {
          const refContext = await browser.newContext({
            viewport: { width: board.width, height: board.height },
            locale: LOCALE[lang],
            reducedMotion: 'reduce',
            deviceScaleFactor: 1,
          });
          const refPage = await refContext.newPage();
          await openReference(refPage, lang, 'light');
          await state.act(refPage, lang);
          const expected = await screenshot(refPage);
          await refContext.close();

          await openApp(page, lang, 'light');
          await state.act(page, lang);
          const actual = await screenshot(page);

          const result = diffImages(actual, expected);
          expect(result.sizeMismatch, 'tamaño de página distinto al diseño').toBe(false);
          expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
        });
      });
    }
  }
}
