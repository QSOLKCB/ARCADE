// SPDX-License-Identifier: Apache-2.0
// Discover only preinstalled, runner-owned Playwright tooling. Never install packages.
// Adapted from QSOLKCB/VANILLAJS scripts/rtx-playwright.mjs (Apache-2.0, same owner):
// the same search roots and the same pinned version as the VANILLAJS RTX workflows.
import {createRequire} from 'node:module';
import {existsSync,readFileSync,realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import {delimiter,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot=resolve(import.meta.dirname,'..');
export const PLAYWRIGHT_PIN='1.64.0';
const load=createRequire(import.meta.url);

export function playwrightSearchRoots({env=process.env,home=homedir(),executable=process.execPath}={}){
  const paths=(env.NODE_PATH||'').split(delimiter).filter(Boolean);
  const prefixes=[dirname(dirname(executable))];
  try{prefixes.push(dirname(dirname(realpathSync(executable))));}catch{}
  paths.push(
    join(home,'.local','share','qsol','browser-tools','node_modules'),
    join(home,'.local','lib','node_modules'),
    join(home,'.npm-global','lib','node_modules'),
    ...prefixes.map(prefix=>join(prefix,'lib','node_modules')),
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules'
  );
  // NODE_PATH is consulted before fallbacks; never resolve relative paths against a checkout.
  return [...new Set(paths.filter(isAbsolute))];
}

function within(parent,child){
  const rel=relative(parent,child);
  return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep));
}

// pin=null accepts any version (dry runs only; such reports are never evidence).
export function findPlaywright({roots=playwrightSearchRoots(),checkout=repoRoot,pin=PLAYWRIGHT_PIN}={}){
  for(const candidate of roots){
    if(!isAbsolute(candidate))continue;
    const packageDir=join(candidate,'playwright');
    if(!existsSync(join(packageDir,'package.json')))continue;
    const actual=realpathSync(packageDir);
    if(within(resolve(checkout),actual))
      throw Error('Refusing to execute Playwright tooling from inside the ARCADE checkout: '+actual);
    let metadata,playwright;
    try{
      metadata=JSON.parse(readFileSync(join(actual,'package.json'),'utf8'));
      if(metadata.name!=='playwright')throw Error('Unexpected package identity '+JSON.stringify(metadata.name));
      if(pin&&metadata.version!==pin)throw Error('Expected pinned Playwright '+pin+', found '+JSON.stringify(metadata.version));
      playwright=load(actual);
      if(typeof playwright?.chromium?.launch!=='function')throw Error('Package does not expose chromium.launch');
    }catch(error){
      throw Error('Found Playwright at '+actual+' but it is not usable: '+error.message);
    }
    return {chromium:playwright.chromium,version:metadata.version,location:actual};
  }
  throw Error('Playwright Node package not found in local tooling directories. Checked: '+
    roots.join(', ')+'. Install it once outside the repository or point NODE_PATH to an existing node_modules directory. No automatic installation is performed.');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const tool=findPlaywright();
    console.log('Playwright local tooling: '+tool.version+' ('+tool.location+')');
  }catch(error){
    console.error('TRUSTED GPU PLAYWRIGHT PREFLIGHT FAILED: '+error.message);
    process.exitCode=1;
  }
}
