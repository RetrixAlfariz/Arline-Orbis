import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const out='docs/design/terrain-math';await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1000}});await page.goto('http://127.0.0.1:4180');
await page.getByRole('navigation',{name:'Studio navigation'}).getByRole('button',{name:'Terrain',exact:true}).click();
await page.getByLabel('Workshop detail',{exact:true}).selectOption('720');
await page.getByRole('button',{name:'3D Globe',exact:true}).click();
for(const [algorithm,name] of [['m4-plates-v1','legacy'],['m5-continuous-v1','continuous']]){
  await page.locator('.workshop-nav button').filter({hasText:'Parameters'}).click();
  await page.getByLabel('Workshop algorithm',{exact:true}).selectOption(algorithm);
  await page.getByRole('button',{name:'Generate final',exact:true}).click();
  await page.getByTestId('workshop-preview').filter({hasText:'Final result'}).waitFor({timeout:60000});
  await page.locator('.globe canvas').waitFor();await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/studio-${name}-globe.png`});
  await page.getByRole('button',{name:'2D Atlas',exact:true}).click();await page.waitForTimeout(300);
  await page.screenshot({path:`${out}/studio-${name}-atlas.png`});
  await page.getByRole('button',{name:'3D Globe',exact:true}).click();
}
await browser.close();console.log('Matched-seed M4/M5 studio screenshots captured.');
