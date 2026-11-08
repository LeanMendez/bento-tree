import { expect, test } from '@playwright/test';

test.use({ locale: 'es-AR', permissions: ['clipboard-read', 'clipboard-write'] });

test('copiar email: copia la dirección y confirma; vuelve al texto original', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('[data-copy-email]');
  const email = await button.getAttribute('data-copy-email');
  await button.click();
  await expect(button).toContainText('¡Email copiado!');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(email);
  await expect(button).toContainText('Copiar email', { timeout: 4000 });
});

test('compartir copia la URL actual', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Compartir esta página' }).click();
  await expect(page.locator('[data-share-label]')).toHaveText('¡Link copiado!');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
});

test('el tema elegido persiste entre recargas y actualiza el label', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Cambiar a modo claro' })).toBeVisible();
});

test('filtros: muestran solo la categoría y "Todo" restaura', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Social', exact: true }).click();
  await expect(page.getByRole('link', { name: /LinkedIn/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Twitch/ })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Social', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Todo', exact: true }).click();
  await expect(page.getByRole('link', { name: /Twitch/ })).toBeVisible();
});

test.describe('idioma', () => {
  test.use({ locale: 'en-US' });

  test('primera visita con navegador en inglés redirige a /en/', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('una elección explícita de ES no se pisa con la autodetección', async ({ page }) => {
    await page.goto('/en/');
    await page.getByRole('link', { name: 'Español' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });
});
