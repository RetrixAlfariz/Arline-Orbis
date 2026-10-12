import { test, expect } from '@playwright/test';

test('names a landmark, preserves its anchor between views and raycasts the globe', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('application')).toBeVisible();
  await page.getByRole('button', { name: /Crown mountain/ }).click();
  await expect(page.getByTestId('latitude')).toHaveText('30.0000°');
  await expect(page.getByTestId('longitude')).toHaveText('-55.0000°');
  const height = await page.getByTestId('elevation').innerText();
  await page.getByLabel('Landmark name', { exact: true }).fill('Vian’s Observatory');
  await page.getByRole('button', { name: 'Set landmark', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vian’s Observatory' })).toBeVisible();
  // Display layers must not alter the shared authored anchor or hide authored markers.
  await page.getByLabel('Grid', { exact: true }).uncheck();
  await expect(page.getByTestId('atlas-grid')).toHaveCount(0);
  await page.getByLabel('Region labels', { exact: true }).uncheck();
  await expect(page.getByTestId('atlas-region-labels')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select Vian’s Observatory', exact: true })).toBeVisible();
  await expect(page.getByTestId('latitude')).toHaveText('30.0000°');
  await expect(page.getByTestId('elevation')).toHaveText(height);
  await page.getByLabel('Grid', { exact: true }).check();
  await page.getByLabel('Region labels', { exact: true }).check();
  await page.getByRole('button', { name: '3D Globe', exact: true }).click();
  const globe = page.locator('.globe canvas');
  await expect(globe).toBeVisible();
  await expect(page.getByTestId('latitude')).toHaveText('30.0000°');
  await expect(page.getByTestId('longitude')).toHaveText('-55.0000°');
  await expect(page.getByTestId('elevation')).toHaveText(height);
  await page.screenshot({ path: 'test-results/m0-globe.png', fullPage: true });

  const bounds = (await globe.boundingBox())!;
  // The selected marker is centered by the camera. Clicking it must recover its exact authored anchor.
  await globe.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  await expect(page.getByTestId('latitude')).toHaveText('30.0000°');
  await expect(page.getByTestId('longitude')).toHaveText('-55.0000°');
  // Dragging rotates without selecting a new position.
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 100, bounds.y + bounds.height / 2 + 30, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId('latitude')).toHaveText('30.0000°');
  await globe.click({ position: { x: bounds.width / 2 + 30, y: bounds.height / 2 } });
  await expect(page.getByTestId('latitude')).not.toHaveText('30.0000°');
  await page.getByRole('button', { name: /Vian’s Observatory.*30.00/ }).click();
  await expect(page.getByTestId('latitude')).toHaveText('30.0000°');
  await page.getByRole('button', { name: '2D Atlas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Vian’s Observatory', exact: true })).toBeVisible();
  await page.getByLabel('Landmark name', { exact: true }).fill('Crown Observatory');
  await page.getByRole('button', { name: 'Update landmark', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Crown Observatory', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/m0-atlas.png', fullPage: true });
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('application')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Crown Observatory', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('atlas pointer, keyboard, seam coordinates and seabed fixtures work without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.includes('webgl')) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Lantern ridge/ }).click();
  await expect(page.getByTestId('elevation')).toHaveText(/−|-\d/);
  await page.getByRole('button', { name: '3D Globe', exact: true }).click();
  await expect(page.getByText(/WebGL is unavailable/)).toBeVisible();
  await expect(page.getByRole('application')).toBeVisible();
  await page.getByRole('button', { name: /Veil trench/ }).click();
  await expect(page.getByTestId('latitude')).toHaveText('-20.0000°');
  await page.getByText('Go to coordinates', { exact: true }).click();
  await page.getByLabel('Latitude', { exact: true }).fill('90');
  await page.getByLabel('Longitude', { exact: true }).fill('180');
  await page.getByRole('button', { name: 'Inspect position', exact: true }).click();
  await expect(page.getByTestId('latitude')).toHaveText('90.0000°');
  await expect(page.getByTestId('longitude')).toHaveText('-180.0000°');
  const atlas = page.getByRole('application');
  await atlas.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('longitude')).toHaveText('-179.0000°');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('latitude')).toHaveText('90.0000°');
  await page.getByRole('button', { name: 'Minimize Places & files', exact: true }).click();
  await atlas.click({ position: { x: 100, y: 200 } });
  await expect(page.getByTestId('latitude')).not.toHaveText('90.0000°');
  expect(errors).toEqual([]);
});

test('mobile layout fits and app requests no external service', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url()); });
  await page.goto('/');
  await page.getByText('Layout', { exact: true }).click();
  await page.getByRole('button', { name: 'Places & files', exact: true }).click();
  await page.getByRole('button', { name: /Crown mountain/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/m0-mobile.png', fullPage: true });
  expect(external).toEqual([]);
});

test('graphics context loss returns to the atlas without losing a landmark', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Lantern ridge/ }).click();
  await page.getByLabel('Landmark name', { exact: true }).fill('Ridge station');
  await page.getByRole('button', { name: 'Set landmark', exact: true }).click();
  await page.getByRole('button', { name: '3D Globe', exact: true }).click();
  await expect(page.locator('.globe canvas')).toBeVisible();
  await page.locator('.globe canvas').evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context-loss test extension is unavailable.');
    extension.loseContext();
  });
  await expect(page.getByText(/graphics context was lost/)).toBeVisible();
  await expect(page.getByRole('application')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ridge station' })).toBeVisible();
  await expect(page.getByTestId('latitude')).toHaveText('-15.0000°');
});
