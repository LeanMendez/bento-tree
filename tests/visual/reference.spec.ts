import { expect, test } from '@playwright/test';
import { ARTBOARDS, LOCALE, hasReference, openReference, screenshot, type Lang, type Theme } from './harness';

const LANGS: Lang[] = ['es', 'en'];
const THEMES: Theme[] = ['light', 'dark'];

test.skip(!hasReference, 'design/reference.html no está (export local de Claude Design)');

for (const board of ARTBOARDS) {
  for (const lang of LANGS) {
    for (const theme of THEMES) {
      test.describe(`${board.name} ${lang} ${theme}`, () => {
        test.use({
          viewport: { width: board.width, height: board.height },
          locale: LOCALE[lang],
          reducedMotion: 'reduce',
        });

        test('captura el diseño de referencia', async ({ page }, testInfo) => {
          await openReference(page, lang, theme);
          await expect(page.locator('main.root')).toHaveAttribute('lang', lang);
          await expect(page.locator('main.root')).toHaveClass(new RegExp(theme));

          const png = await screenshot(page);
          await testInfo.attach(`reference-${board.name}-${lang}-${theme}.png`, {
            body: png,
            contentType: 'image/png',
          });
        });
      });
    }
  }
}
