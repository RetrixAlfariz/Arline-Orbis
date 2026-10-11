import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const saved = (page: import('@playwright/test').Page) => expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
test('drafts survive selection and reload; authors can lock, move, delete, undo and recover', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Landmark name', { exact: true }).fill('Unfinished observatory');
  await saved(page);
  await page.getByRole('button', { name: /Lantern ridge/ }).click();
  await page.getByRole('button', { name: /Crown mountain/ }).click();
  await expect(page.getByLabel('Landmark name', { exact: true })).toHaveValue('Unfinished observatory');
  await saved(page); await page.reload();
  await expect(page.getByLabel('Landmark name', { exact: true })).toHaveValue('Unfinished observatory');
  await page.getByLabel('Authored elevation (m)', { exact: true }).fill('4800');
  await page.getByRole('button', { name: 'Set landmark', exact: true }).click();
  await expect(page.getByTestId('elevation')).toHaveText('+4,800 m');
  await expect(page.getByTestId('terrain-elevation')).toHaveText('+5,302 m');
  await page.getByRole('button', { name: 'Lock landmark', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Update landmark', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete landmark', exact: true })).toBeDisabled();
  await saved(page); await page.reload();
  await expect(page.getByRole('button', { name: 'Unlock landmark', exact: true })).toBeVisible();
  await page.getByText('World settings', { exact: true }).click();
  await page.getByLabel('Terrain seed', { exact: true }).fill('regenerated-world');
  await page.getByRole('button', { name: 'Apply world settings', exact: true }).click();
  await expect(page.getByTestId('elevation')).toHaveText('+4,800 m');
  await expect(page.getByTestId('terrain-elevation')).not.toHaveText('+5,302 m');
  await expect(page.getByRole('button', { name: 'Update landmark', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Unlock landmark', exact: true }).click();
  await page.getByText('Go to coordinates', { exact: true }).click();
  await page.getByLabel('Latitude', { exact: true }).fill('40');
  await page.getByLabel('Longitude', { exact: true }).fill('180');
  await page.getByRole('button', { name: 'Move landmark to coordinates', exact: true }).click();
  await expect(page.getByTestId('longitude')).toHaveText('-180.0000°');
  await expect(page.getByTestId('elevation')).toHaveText('+4,800 m');
  await page.getByRole('button', { name: 'Delete landmark', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Unfinished observatory', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo last edit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Unfinished observatory', exact: true })).toBeVisible();
  await saved(page); await page.reload();
  await expect(page.getByRole('heading', { name: 'Unfinished observatory', exact: true })).toBeVisible();
  await page.getByLabel('Search landmarks', { exact: true }).fill('no matches');
  await expect(page.getByText('No matching landmarks.')).toBeVisible();
});

test('portable import/export retains ownership; invalid input leaves the world intact', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Landmark name', { exact: true }).fill('Portable station');
  await page.getByRole('button', { name: 'Set landmark', exact: true }).click();
  await page.getByRole('button', { name: 'Lock landmark', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const contents = await readFile((await download.path())!, 'utf8');
  const exported = JSON.parse(contents);
  expect(exported.landmarks[0].locked).toBe(true);
  const upload = page.getByLabel('Import project file', { exact: true });
  await upload.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"orbis-project","version":99}') });
  await expect(page.getByRole('alert')).toHaveText(/Import rejected/);
  await expect(page.getByRole('heading', { name: 'Portable station', exact: true })).toBeVisible();
  const modified = { ...exported, planet: { ...exported.planet, seed: 'different-seed', radius_m: 3000000, sea_level_m: 125 } };
  await upload.setInputFiles({ name: 'valid.orbis.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(modified)) });
  await saved(page); await page.reload();
  await expect(page.getByRole('button', { name: 'Unlock landmark', exact: true })).toBeVisible();
  await expect(page.getByTestId('elevation')).toHaveText('+5,302 m');
  await expect(page.getByText('Radius 3,000 km', { exact: true })).toBeVisible();
  expect(exported.landmarks[0].id).toBeTruthy();
  const secondDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const second = JSON.parse(await readFile((await (await secondDownload).path())!, 'utf8'));
  expect(second.landmarks).toEqual(exported.landmarks);
  await page.getByText(/Recovery history/).click();
  await page.getByLabel('Choose a backup', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Restore backup', exact: true }).click();
  await expect(page.getByText('Radius 6,371 km', { exact: true })).toBeVisible();
});

test('sea level, water visibility and bathymetry share the atlas and globe; distance uses radius', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Lantern ridge/ }).click();
  await expect(page.getByTestId('water-depth')).toHaveText('923 m');
  const image = page.locator('.atlas image'); const original = await image.getAttribute('href');
  await page.getByText('World settings', { exact: true }).click();
  await page.getByLabel('Sea level (m)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Apply world settings', exact: true }).click();
  await expect(page.getByTestId('water-depth')).toHaveText('1,023 m');
  await expect(page.getByTestId('elevation')).toHaveText('-923 m');
  await expect(image).not.toHaveAttribute('href', original!);
  await page.getByLabel('Bathymetry', { exact: true }).check();
  await expect(page.getByLabel('Water depth legend', { exact: true })).toBeVisible();
  await page.getByLabel('Water', { exact: true }).uncheck();
  await expect(page.getByTestId('water-depth')).toHaveText('1,023 m');
  await page.getByRole('button', { name: '3D Globe', exact: true }).click();
  await expect(page.locator('.globe canvas')).toBeVisible();
  await page.locator('.globe canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('longitude')).toHaveText('41.0000°');
  await page.getByRole('button', { name: /Lantern ridge/ }).click();
  await page.getByLabel('Water', { exact: true }).check();
  await expect(page.getByTestId('elevation')).toHaveText('-923 m');
  await page.getByText('Measure distance', { exact: true }).click();
  await page.getByRole('button', { name: 'Set start at selection', exact: true }).click();
  await page.getByRole('button', { name: /Veil trench/ }).click();
  const distance = Number((await page.getByTestId('distance').innerText()).replace(/[,a-z ]/g, ''));
  expect(distance).toBeGreaterThan(6000);
  await page.getByLabel('Planet radius (km)', { exact: true }).fill('3185.5');
  await page.getByRole('button', { name: 'Apply world settings', exact: true }).click();
  const half = Number((await page.getByTestId('distance').innerText()).replace(/[,a-z ]/g, ''));
  expect(half).toBeCloseTo(distance / 2, 1);
  await page.locator('.inspector').evaluate((panel) => { panel.scrollTop = 0; });
  await page.screenshot({ path: 'test-results/m1-globe.png', fullPage: true });
});

test('atlas zoom and drag preserve selection; short and zoomed layouts stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Zoom in atlas', exact: true }).click();
  const atlas = page.getByRole('application');
  const before = await atlas.getAttribute('viewBox');
  const box = (await atlas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 6 }); await page.mouse.up();
  await expect(atlas).not.toHaveAttribute('viewBox', before!);
  await expect(page.getByTestId('latitude')).toHaveText('30.0000°');
  await page.getByRole('button', { name: 'Reset atlas view', exact: true }).click();
  await expect(atlas).toHaveAttribute('viewBox', '-25 -25 1050 550');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/m1-laptop.png', fullPage: true });
  await page.setViewportSize({ width: 683, height: 384 }); // CSS viewport equivalent to 200% browser zoom on a laptop.
  await page.getByLabel('Landmark name', { exact: true }).fill('Small-screen station');
  await page.getByRole('button', { name: 'Set landmark', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/m1-mobile.png', fullPage: true });
});

test('concurrent tabs reject a stale save instead of overwriting the first tab', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save world', exact: true }).click(); await saved(page);
  const other = await context.newPage(); await other.goto('/');
  await expect(other.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.getByLabel('Landmark name', { exact: true }).fill('First tab station');
  await page.getByRole('button', { name: 'Set landmark', exact: true }).click(); await saved(page);
  await other.getByLabel('Landmark name', { exact: true }).fill('Other tab draft');
  await expect(other.getByRole('alert')).toHaveText(/Another tab saved/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'First tab station', exact: true })).toBeVisible();
});

test('storage failure is explicit and export remains available', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Storage denied'); } }); });
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText(/Local storage could not be opened/);
  await page.getByLabel('Landmark name', { exact: true }).fill('Unsaved station');
  await page.getByRole('button', { name: 'Set landmark', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect(JSON.parse(await readFile((await (await download).path())!, 'utf8')).landmarks[0].name).toBe('Unsaved station');
});

test('reopens an emergency journal after an interrupted save', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save world', exact: true }).click(); await saved(page);
  await page.evaluate(async () => {
    const stored = await new Promise<any>((resolve, reject) => {
      const request = indexedDB.open('orbis-workspace', 1);
      request.onsuccess = () => { const read = request.result.transaction('workspace').objectStore('workspace').get('current'); read.onsuccess = () => { request.result.close(); resolve(read.result); }; read.onerror = () => reject(read.error); };
      request.onerror = () => reject(request.error);
    });
    stored.project.drafts = [{ lat_deg: 30, lon_deg: -55, altitude_m: 5302, name: 'Recovered draft' }];
    localStorage.setItem(`orbis-journal:${sessionStorage.getItem('orbis-tab')}`, JSON.stringify({ ...stored, at: new Date().toISOString() }));
  });
  await page.reload();
  await expect(page.getByLabel('Landmark name', { exact: true })).toHaveValue('Recovered draft'); await saved(page);
  await page.reload();
  await expect(page.getByLabel('Landmark name', { exact: true })).toHaveValue('Recovered draft');
});

test('invalid authored elevation does not corrupt a saved draft', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Landmark name', { exact: true }).fill('Valid draft'); await saved(page);
  await page.getByLabel('Authored elevation (m)', { exact: true }).fill('999999');
  await expect(page.getByRole('alert')).toHaveText(/Elevation must be/);
  await page.reload();
  await expect(page.getByLabel('Landmark name', { exact: true })).toHaveValue('Valid draft');
  await expect(page.getByLabel('Authored elevation (m)', { exact: true })).toHaveValue('5302');
});
