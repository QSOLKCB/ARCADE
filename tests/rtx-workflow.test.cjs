'use strict';
// The RTX workflow runs on the owner's personal workstation. These static checks keep
// it owner-dispatched only, pinned and least-privileged, and keep its harness fail-closed.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const yml=fs.readFileSync(path.join(root,'.github/workflows/rtx5060ti-arcade2.yml'),'utf8');
const onBlock=yml.slice(yml.indexOf('\non:'),yml.indexOf('\npermissions:'));

test('RTX workflow is owner-dispatched only, on reviewed main, with explicit consent',()=>{
 assert.match(onBlock,/^\non:\n  workflow_dispatch:/);
 for(const trigger of ['push','pull_request','pull_request_target','schedule','workflow_run','workflow_call','repository_dispatch','issue_comment'])
  assert.ok(!new RegExp('^  '+trigger+':','m').test(onBlock),'no '+trigger+' trigger');
 assert.match(yml,/if: \$\{\{ github\.repository == 'QSOLKCB\/ARCADE' && github\.ref == 'refs\/heads\/main' && github\.actor == 'EmergentMonk' && inputs\.acknowledge_local_execution == true \}\}/);
 for(const input of ['acknowledge_local_execution','play_sound','publish_evidence'])
  assert.match(yml,new RegExp(input+':[\\s\\S]*?type: boolean[\\s\\S]*?default: false'),input+' defaults to false');
 assert.match(yml,/runs-on: \[self-hosted, linux, x64, qsol-rtx5060ti\]/);
});
test('RTX workflow is least-privileged, SHA-pinned and uploads only on consent',()=>{
 assert.match(yml,/^permissions:\n  contents: read\n/m);
 assert.ok(!/write/.test(yml.slice(yml.indexOf('permissions:'),yml.indexOf('concurrency:'))));
 const uses=[...yml.matchAll(/uses: ([^\s]+)/g)].map(m=>m[1]);
 assert.ok(uses.length>=2);for(const u of uses)assert.match(u,/^actions\/[\w-]+@[0-9a-f]{40}$/,u+' pinned to a commit');
 assert.match(yml,/persist-credentials: false/);
 assert.match(yml,/if: \$\{\{ always\(\) && inputs\.publish_evidence == true/);
 // Expressions never expand inside shell scripts; values reach them through env only.
 const scripts=[...yml.matchAll(/run: \|\n((?: {10}.*\n|\n)+)/g)].map(m=>m[1]);
 assert.ok(scripts.length>=5,'run blocks found: '+scripts.length);
 for(const script of scripts)assert.ok(!script.includes('${{'),'no ${{ }} inside a run block');
 assert.ok(!/npm (install|ci)|npx |pip install|curl |wget /.test(yml),'no installs or downloads');
});
test('RTX harness refuses bad arguments and non-evidence environments before launching a browser',()=>{
 const run=args=>cp.spawnSync(process.execPath,[path.join(root,'scripts/rtx5060ti-arcade2.mjs'),...args],{cwd:root,encoding:'utf8',timeout:20000});
 const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 for(const args of [[],['--expected-head','nothex','--baseline','/x','--out','/y'],['--expected-head',head,'--baseline','relative','--out','/y'],['--bogus']]){
  const r=run(args);assert.notEqual(r.status,0,args.join(' '));assert.match(r.stderr,/FAILED/);
 }
 // A wrong head is refused even in a dry run; without --dry-run every non-evidence
 // environment (non-main, dirty, no desktop, missing baseline) fails before Chrome starts.
 assert.match(run(['--dry-run','--expected-head','0'.repeat(40),'--baseline','/nonexistent','--out','/nonexistent/out']).stderr,/does not match HEAD/);
 const strict=run(['--expected-head',head,'--baseline','/nonexistent','--out','/nonexistent/out']);
 assert.notEqual(strict.status,0);assert.ok(!fs.existsSync('/nonexistent/out'));
});
