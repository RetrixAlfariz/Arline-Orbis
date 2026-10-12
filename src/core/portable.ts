import { MAX_PROJECT_BYTES } from './project';
/** Bound decompressed size while streaming, not after a potentially huge allocation. */
export async function readProjectFile(file:File):Promise<string>{
  if(file.size>MAX_PROJECT_BYTES)throw new Error('Project exceeds the 2 MB limit.');
  const header=new Uint8Array(await file.slice(0,2).arrayBuffer());
  if(header[0]!==0x1f||header[1]!==0x8b)return file.text();
  if(typeof DecompressionStream==='undefined')throw new Error('Compressed import is unavailable in this browser; use JSON export.');
  const reader=file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks:Uint8Array[]= [];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_PROJECT_BYTES){await reader.cancel();throw new Error('Decompressed project exceeds the 2 MB limit.');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function compressedProject(json:string):Promise<Blob>{
  if(typeof CompressionStream==='undefined')throw new Error('Compression is unavailable in this browser; use JSON export.');
  return new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
