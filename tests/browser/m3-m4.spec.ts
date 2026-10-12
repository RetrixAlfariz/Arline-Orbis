import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
const saved=(page:import('@playwright/test').Page)=>expect(page.getByText('Saved locally',{exact:true})).toBeVisible();

test('geographic features retain vertices, locks, lore and era across projections and export',async({page})=>{
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByText(/Map features & lore/).click();
  await page.getByLabel('Feature name',{exact:true}).fill('Northern passage');
  await page.getByLabel('Feature coordinates',{exact:true}).fill('28, -58\n30, -55\n32, -52');
  await page.getByLabel('Feature lore',{exact:true}).fill('The route used during the First Age.');
  await page.getByLabel('Feature tags',{exact:true}).fill('road, canon');
  await page.getByLabel('Story references',{exact:true}).fill('chapter:crossing');
  await page.getByText('Manage local eras',{exact:true}).click();
  await page.getByLabel('New era name',{exact:true}).fill('First Age');
  await page.getByRole('button',{name:'Add era',exact:true}).click();
  await page.getByRole('button',{name:'Save feature',exact:true}).click();
  await page.getByRole('button',{name:'Lock feature',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save feature',exact:true})).toBeDisabled();
  await expect(page.getByTestId('map-feature')).toHaveCount(1);
  for(const projection of ['equal-earth','orthographic','regional','equirectangular']){
    await page.getByLabel('Map projection',{exact:true}).selectOption(projection);
    await expect(page.getByTestId('map-feature')).toHaveCount(1);
  }
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();
  const project=JSON.parse(await readFile((await(await download).path())!,'utf8'));
  expect(project.version).toBe(3);expect(project.features[0].coordinates).toEqual([{lat_deg:28,lon_deg:-58},{lat_deg:30,lon_deg:-55},{lat_deg:32,lon_deg:-52}]);
  expect(project.features[0].locked).toBe(true);expect(project.features[0].description).toContain('First Age');expect(project.features[0].era_id).toBe(project.eras[0].id);
  await page.screenshot({path:'test-results/m4-features.png',fullPage:true});
  await saved(page);await page.reload();await expect(page.getByTestId('map-feature')).toHaveCount(1);
  const svg=page.waitForEvent('download');await page.getByRole('button',{name:'Export atlas SVG',exact:true}).click();
  expect((await svg).suggestedFilename()).toBe('orbis-atlas.svg');
});

test('underground authoring, depth slices, route, cave proposal, 3D and reload are functional',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/');await page.getByRole('button',{name:'Underground',exact:true}).click();
  await page.getByLabel('Cave node name',{exact:true}).fill('Deep archive');
  await page.getByLabel('Cave depth below ground (m)',{exact:true}).fill('2500');
  await page.getByLabel('Cave lore',{exact:true}).fill('The oldest library under Crown mountain.');
  await page.getByRole('button',{name:'Save underground node',exact:true}).click();
  await expect(page.getByTestId('cave-depth')).toHaveText('2500 m');
  await page.getByRole('button',{name:'Lock node',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save underground node',exact:true})).toBeDisabled();
  await page.getByLabel('Depth slice',{exact:true}).check();
  await page.getByLabel('Underground slice altitude',{exact:true}).fill('2802');
  await expect(page.getByTestId('cave-section')).toBeVisible();
  await page.getByRole('button',{name:'Suggest cave network at selection',exact:true}).click();
  await page.getByRole('button',{name:'Accept cave proposal',exact:true}).click();
  await page.getByText('Find a passage route',{exact:true}).click();
  await page.getByLabel('Route from',{exact:true}).selectOption({label:'Surface entrance'});
  await page.getByLabel('Route to',{exact:true}).selectOption({label:'Chamber 6'});
  await expect(page.getByTestId('cave-route')).toContainText('0 portals');
  await page.getByRole('button',{name:'Local 3D cave',exact:true}).click();await expect(page.locator('.cave-scene canvas')).toBeVisible();
  await page.screenshot({path:'test-results/m4-caves.png',fullPage:true});
  await page.getByRole('button',{name:'Show section',exact:true}).click();await page.screenshot({path:'test-results/m4-section.png',fullPage:true});
  await saved(page);await page.reload();await page.getByRole('button',{name:'Underground',exact:true}).click();
  await page.getByLabel('Underground node',{exact:true}).selectOption({label:'Deep archive · locked'});
  await expect(page.getByTestId('cave-depth')).toHaveText('2500 m');
  await expect(page.getByLabel('Cave lore',{exact:true})).toHaveValue('The oldest library under Crown mountain.');
});

test('generation runs off-thread, is cancellable, and commits only a reviewed deterministic world',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/');
  const before=await page.getByTestId('elevation').innerText();
  await page.getByText('Planetary generation · M4',{exact:true}).click();
  await page.getByLabel('Generation detail',{exact:true}).selectOption('1440');
  await page.getByRole('button',{name:'Preview generation',exact:true}).click();
  await page.getByRole('button',{name:'Cancel generation',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('cancelled');await expect(page.getByTestId('elevation')).toHaveText(before);
  await page.getByLabel('Generation detail',{exact:true}).selectOption('360');
  await page.getByLabel('Geology seed',{exact:true}).fill('orbis-complete-42');
  const start=Date.now();
  await page.evaluate(()=>{(window as any).__beats=0;(window as any).__clock=setInterval(()=>{(window as any).__beats++;},20);});
  await page.getByRole('button',{name:'Preview generation',exact:true}).click();
  await expect(page.getByTestId('generation-preview')).toBeVisible({timeout:45000});
  const generatorMs=Number(await page.getByTestId('generation-preview').getAttribute('data-generation-ms'));
  const beats=await page.evaluate(()=>{clearInterval((window as any).__clock);return (window as any).__beats;});expect(beats).toBeGreaterThan(2);
  await expect(page.getByTestId('elevation')).toHaveText(before);
  await page.getByRole('button',{name:'Apply generated world',exact:true}).click();
  await expect(page.getByLabel('Geographic system layer',{exact:true})).toBeVisible();
  for(const layer of ['plates','landforms','temperature','rainfall','biomes','water','relief'])await page.getByLabel('Geographic system layer',{exact:true}).selectOption(layer);
  await saved(page);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();
  const project=JSON.parse(await readFile((await(await download).path())!,'utf8'));expect(project.planet.algorithm_version).toBe('m4-plates-v1');expect(project.generation_options.resolution).toBe(360);
  const height=await page.getByTestId('elevation').innerText();
  await page.screenshot({path:'test-results/m4-planet.png',fullPage:true});
  await page.reload();await expect(page.getByLabel('Geographic system layer',{exact:true})).toBeVisible({timeout:30000});await expect(page.getByTestId('elevation')).toHaveText(height);
  await writeFile('test-results/m4-worker-metrics.json',JSON.stringify({generation_ms:generatorMs,generation_resolution:360,cpu:os.cpus()[0]?.model,logical_cpus:os.cpus().length,system_memory_gib:os.totalmem()/2**30,platform:os.platform(),node:process.version,browser:await page.context().browser()?.version(),generationWorkflow_ms:Date.now()-start,heartbeat_ticks:beats,viewport:page.viewportSize(),note:'End-to-end preview/apply/export/screenshot/reload time, not pure generator latency.'},null,2));
});

test('locked location conflicts require acknowledgement and preserve authored height',async({page})=>{
  test.setTimeout(60000);
  await page.goto('/');await page.getByLabel('Landmark name',{exact:true}).fill('Protected canon');await page.getByLabel('Authored elevation (m)',{exact:true}).fill('4800');
  await page.getByRole('button',{name:'Set landmark',exact:true}).click();await page.getByRole('button',{name:'Lock landmark',exact:true}).click();
  await page.getByText('Planetary generation · M4',{exact:true}).click();await page.getByRole('button',{name:'Preview generation',exact:true}).click();await expect(page.getByTestId('generation-preview')).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Apply generated world',exact:true})).toBeDisabled();
  await page.getByLabel('Accept reviewed terrain changes',{exact:true}).check();await page.getByRole('button',{name:'Apply generated world',exact:true}).click();
  await expect(page.getByTestId('elevation')).toHaveText('+4,800 m');await expect(page.getByRole('button',{name:'Update landmark',exact:true})).toBeDisabled();await saved(page);
});

test('regional tiles refine on demand, cancel, and preserve the shared geographic anchor',async({page})=>{
  test.setTimeout(60000);
  await page.goto('/');const lat=await page.getByTestId('latitude').innerText();
  await page.getByRole('button',{name:'Regional detail',exact:true}).click();
  await expect(page.getByAltText('Detailed geographic terrain tile')).toBeVisible();
  await expect(page.getByText('129 × 129 · detailed tile',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'+ Zoom in',exact:true}).click();await expect(page.getByText('129 × 129 · detailed tile',{exact:true})).toBeVisible();
  await expect(page.getByTestId('tile-cache')).toContainText('2 tiles');
  await expect(page.getByTestId('latitude')).toHaveText(lat);
  await page.screenshot({path:'test-results/m4-region.png',fullPage:true});
});

test('production app reloads offline including lazy globe and compressed project round trip',async({page,context},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
  try {
  test.setTimeout(60000);test.skip(!process.env.ORBIS_E2E_PREVIEW,'Service worker is production-only.');
  await page.goto('/');await expect(page.getByText('Offline ready',{exact:true})).toBeVisible({timeout:15000});
  await page.getByLabel('Landmark name',{exact:true}).fill('Offline station');await page.getByRole('button',{name:'Set landmark',exact:true}).click();await saved(page);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export compressed .orbis',exact:true}).click();
  const file=await(await download).path();expect(file).toBeTruthy();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Offline station',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'3D Globe',exact:true}).click();await expect(page.locator('.globe canvas')).toBeVisible();
  await page.getByLabel('Import project file',{exact:true}).setInputFiles({name:'world.orbis',mimeType:'application/gzip',buffer:await readFile(file!)});
  await expect(page.getByRole('heading',{name:'Offline station',exact:true})).toBeVisible();await saved(page);
  } finally {if(errors.length)await testInfo.attach('offline-failed-requests',{body:errors.join('\n'),contentType:'text/plain'});}
});


test('authored lake polygons have an independent level, lock and portable geometry',async({page})=>{
  await page.goto('/');await page.getByText(/Map features & lore/).click();
  await page.getByLabel('Feature name',{exact:true}).fill('Crown lake');
  await page.getByLabel('Feature geometry',{exact:true}).selectOption('polygon');
  await page.getByLabel('Feature layer',{exact:true}).selectOption('lake');
  await page.getByLabel('Feature coordinates',{exact:true}).fill('29.8, -55.2\n30.2, -55.2\n30.2, -54.8\n29.8, -54.8');
  await page.getByLabel('Lake surface altitude (m)',{exact:true}).fill('5500');
  await page.getByRole('button',{name:'Save feature',exact:true}).click();
  await expect(page.getByTestId('local-water-level')).toHaveText('+5,500 m');
  await expect(page.getByTestId('water-depth')).toHaveText('198 m');
  await page.getByRole('button',{name:'Lock feature',exact:true}).click();await saved(page);
  await page.reload();await expect(page.getByTestId('local-water-level')).toHaveText('+5,500 m');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();
  const p=JSON.parse(await readFile((await(await download).path())!,'utf8'));
  expect(p.features[0].kind).toBe('polygon');expect(p.features[0].locked).toBe(true);expect(p.features[0].water_level_m).toBe(5500);
});
