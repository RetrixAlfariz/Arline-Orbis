import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
export function orbisOffline():Plugin {
  return {name:'orbis-offline',apply:'build',generateBundle(_,bundle){
    const names=Object.keys(bundle).filter(name=>/\.(js|css|html)$/.test(name));
    const version=createHash('sha256').update(names.join('|')).digest('hex').slice(0,16);
    const assets=['./','./index.html',...names.filter(n=>n!=='index.html').map(n=>'./'+n),'./manifest.webmanifest','./orbis-icon.svg'];
    this.emitFile({type:'asset',fileName:'sw.js',source:`
const CACHE='orbis-static-${version}';
const FILES=${JSON.stringify(assets)}.map(p=>new URL(p,self.registration.scope).href);
const OWNED=new Set(FILES);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('orbis-static-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const url=e.request.mode==='navigate'?new URL('./index.html',self.registration.scope).href:e.request;
    // Build assets are immutable public bytes. Vite's Vary: Origin must not
    // distinguish the no-Origin precache fetch from a crossorigin module fetch.
    // Never ignore Vary for arbitrary URLs or user-specific content.
    const key=typeof url==='string'?url:url.url;
    return (OWNED.has(key)?await c.match(key,{ignoreVary:true}):undefined)||fetch(e.request);
  })());
});`});
    this.emitFile({type:'asset',fileName:'manifest.webmanifest',source:JSON.stringify({name:'Arline Orbis',short_name:'Orbis',start_url:'.',scope:'.',display:'standalone',background_color:'#e9e5db',theme_color:'#f5f0e6',icons:[{src:'orbis-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]})});
    this.emitFile({type:'asset',fileName:'orbis-icon.svg',source:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="20" fill="#f5f0e6"/><g fill="none" stroke="#354641" stroke-width="4"><circle cx="64" cy="64" r="44"/><ellipse cx="64" cy="64" rx="19" ry="44"/><path d="M20 64h88M30 38h68M30 90h68"/></g></svg>'});
  }};
}
