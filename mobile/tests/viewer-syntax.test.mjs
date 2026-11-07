// The 3D viewer page is one big script inside a template string (sceneHtml.ts): a stray "//" comment in the middle of a line, or an
// unescaped character, silently breaks the whole viewer. This parses the exact page script the app ships.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {resolve,join} from 'node:path';import {execFileSync} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url);const ts=require('typescript');const fs=require('node:fs');
function load(file){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,spec=>load(resolve(file,'..',spec+'.ts')));return exports;}
test('the viewer page script parses',()=>{
  const {CAR3D_HTML}=load(resolve('src/features/car3d/sceneHtml.ts'));
  const scripts=[...CAR3D_HTML.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!/importmap|json/.test(m[1])).map(m=>m[2]).filter(s=>s.trim()); // JS only (not the import map)
  assert.ok(scripts.length>0);
  const dir=mkdtempSync(join(tmpdir(),'viewer-syntax-'));
  try{scripts.forEach((s,i)=>{const f=join(dir,`s${i}.mjs`);writeFileSync(f,s);assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',f],{stdio:'pipe'}),`page script ${i} has a syntax error`);});}
  finally{rmSync(dir,{recursive:true,force:true});}
});
