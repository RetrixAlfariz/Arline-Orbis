import { describe,it,expect } from 'vitest';
import { compressedProject,readProjectFile } from '../../src/core/portable';
import { newProject,decodeProject,MAX_PROJECT_BYTES } from '../../src/core/project';
describe('portable compressed projects',()=>{
  it('round trips JSON and gzip without embedded remote assets',async()=>{
    const json=JSON.stringify(newProject());const compressed=await compressedProject(json);
    expect(await readProjectFile(new File([compressed],'world.orbis'))).toBe(json);
    expect(decodeProject(await readProjectFile(new File([json],'world.json')))).toEqual(newProject());
  });
  it('bounds expansion before accepting a compressed project',async()=>{
    const bomb=await compressedProject(' '.repeat(MAX_PROJECT_BYTES+1));
    await expect(readProjectFile(new File([bomb],'oversized.orbis'))).rejects.toThrow(/Decompressed/);
    await expect(readProjectFile(new File([new Uint8Array([31,139,0,4])],'corrupt.orbis'))).rejects.toThrow();
  });
});
