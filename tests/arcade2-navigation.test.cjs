'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL,fileURLToPath}=require('node:url');
const root=path.resolve(__dirname,'..');
// URL/filesystem checks, not browser execution. Directory auto-indexing is HTTP-only.
for(const page of ['index.html','arcade2/index.html'])test(page+' navigation resolves to real files under file:// and nested HTTP hosting',()=>{
 const html=fs.readFileSync(path.join(root,page),'utf8'),fileBase=pathToFileURL(path.join(root,page));
 const prefix='/nested/ARCADE/',httpBase='https://example.test'+prefix+page;
 let checked=0;
 for(const [,href]of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)){
  if(href.startsWith('#')||/^https?:/.test(href))continue;
  const local=new URL(href,fileBase),hosted=new URL(href,httpBase);
  assert.equal(local.protocol,'file:');assert.ok(fs.statSync(fileURLToPath(local)).isFile(),page+' links to a directory: '+href);
  assert.ok(hosted.pathname.startsWith(prefix));
  assert.equal(fileURLToPath(local),path.join(root,hosted.pathname.slice(prefix.length)));
  checked++;
 }
 assert.ok(checked>0,'navigation links were checked');
});
