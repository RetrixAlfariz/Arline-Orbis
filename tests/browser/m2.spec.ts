import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('create new world, sculpt terrain, save, export and reload v2 edits', async ({ page }) => {
  await page.goto('/');
  await page.getByText('+ Create new world', { exact: true }).click();
  await page.getByLabel('New world name', { exact: true }).fill('Nacre');
  await page.getByLabel('New world seed', { exact: true }).fill('nacre-seed-99');
  await page.getByRole('button', { name: 'Create world', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nacre', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Crown mountain/ })).toHaveCount(0);
  const earlier = await page.getByTestId('elevation').innerText();
  await page.getByText('Terrain sculpting').click();
  await page.getByLabel('Terrain brush radius (km)').fill('800');
  await page.getByLabel('Terrain height change (m)').fill('-1200');
  await page.getByRole('button', { name: 'Apply at selection', exact: true }).click();
  await expect(page.getByText(/Removed last terrain stroke/)).toHaveCount(0);
  await expect(page.getByTestId('elevation')).not.toHaveText(earlier);
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const contents = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(contents.format).toBe('orbis-project');
  expect(contents.version).toBe(2);
  expect(contents.terrain_strokes).toHaveLength(1);
  expect(contents.planet.name).toBe('Nacre');
  expect(contents.planet.algorithm_version).toBe('m2-seeded-v1');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nacre', exact: true })).toBeVisible();
  await expect(page.getByTestId('elevation')).not.toHaveText(earlier);
  const upload = page.getByLabel('Import project file', { exact: true });
  await upload.setInputFiles({ name: 'nacre.orbis.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(contents)) });
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await expect(page.getByTestId('elevation')).not.toHaveText(earlier);
});

test('sculpt mode, atlas palette and profile preserve geographic inspection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Lantern ridge/ }).click();
  await page.getByText('Measure distance', { exact: true }).click();
  await page.getByRole('button', { name: 'Set start at selection' }).click();
  await page.getByRole('button', { name: /Veil trench/ }).click();
  await expect(page.getByTestId('elevation-profile')).toBeVisible();
  const first = await page.locator('.atlas image').getAttribute('href');
  await page.getByLabel('Atlas map style', { exact: true }).selectOption('survey');
  await expect(page.locator('.atlas image')).not.toHaveAttribute('href', first!);
  await page.getByRole('button', { name: 'Sculpt terrain', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sculpt ON', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const trench = await page.getByTestId('elevation').innerText();
  await page.getByRole('button', { name: 'Apply at selection', exact: true }).click();
  await expect(page.getByTestId('elevation')).not.toHaveText(trench);
  await page.getByRole('button', { name: 'Undo last edit', exact: true }).click();
  await expect(page.getByTestId('elevation')).toHaveText(trench);
  await page.getByRole('button', { name: '3D Globe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sculpt ON', exact: true })).toHaveCount(0);
  await expect(page.locator('.globe canvas')).toBeVisible();
  await expect(page.getByTestId('elevation-profile')).toBeVisible();
});

test('locked landmarks block geodesic terrain edits without changing the source', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Crown mountain/ }).click();
  await page.getByLabel('Landmark name', { exact: true }).fill('Protected mountain');
  await page.getByRole('button', { name: 'Set landmark', exact: true }).click();
  await page.getByRole('button', { name: 'Lock landmark', exact: true }).click();
  await page.getByText('Terrain sculpting').click();
  await page.getByRole('button', { name: 'Apply at selection', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(/overlaps locked landmark/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const contents = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(contents.terrain_strokes ?? []).toHaveLength(0);
});
