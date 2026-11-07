// Rims auto-placement rules (sceneHtml RIM_RULES_JS, the exact code the viewer runs): the arch line from ray samples, the whole-wheel move
// (target 5 mm inside, 40 mm cap, largest safe move, override) and the axle from a wheel's points (PCA, refined to the narrowest width).
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {resolve} from 'node:path';
const require=createRequire(import.meta.url);const ts=require('typescript');const fs=require('node:fs');
function load(file){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,spec=>load(resolve(file,'..',spec+'.ts')));return exports;}
const {RIM_RULES_JS,CAR3D_HTML}=load(resolve('src/features/car3d/sceneHtml.ts'));
const R=new Function(RIM_RULES_JS+';return {rimArchEstimate,rimOffsetSearch,rimPCA,rimNarrowestAxis,RIM_TARGET,RIM_MAX_MOVE};')();
const close=(a,b,e=1e-6)=>Math.abs(a-b)<=e;

test('the viewer page embeds the exact rules the tests run',()=>assert.ok(CAR3D_HTML.includes(RIM_RULES_JS)));

test('arch line: median of the samples, outliers dropped; too few or too scattered = not measured',()=>{
  const a=R.rimArchEstimate([0.10,0.101,0.099,0.1,0.102,0.098,0.25,0.1,0.1,-0.2,0.1]);assert.ok(close(a.value,0.1,0.002)&&a.confidence>0.5,JSON.stringify(a));
  assert.equal(R.rimArchEstimate([0.1,0.1,0.1,0.1]).value,null);
  assert.equal(R.rimArchEstimate([0,0.05,0.1,0.15,0.2,0.25,0.3,0.35]).value,null);
});

test('move: tyre face to 5 mm inside the arch line, both ways; at most 40 mm; tiny = no move',()=>{
  const ok=()=>true;
  assert.ok(close(R.rimOffsetSearch(0.025,ok).offset,0.020));                 // 25 mm inside -> out by 20
  assert.ok(close(R.rimOffsetSearch(-0.012,ok).offset,-0.017));               // 12 mm outside -> in by 17
  const far=R.rimOffsetSearch(0.08,ok);assert.ok(close(far.offset,0.04)&&far.warnings.includes('MOVE_CLAMPED_40MM'));
  assert.equal(R.rimOffsetSearch(0.0053,ok).offset,0);
  const none=R.rimOffsetSearch(null,ok);assert.equal(none.offset,0);assert.deepEqual(none.warnings,['ARCH_NOT_MEASURED']);
});

test('move: the largest safe move toward the target, else stock with a warning; never an unsafe one',()=>{
  const lim=R.rimOffsetSearch(0.025,x=>x<=0.011);assert.ok(lim.offset<=0.011&&lim.offset>0.009&&lim.warnings.includes('LIMITED_BY_CLEARANCE'),JSON.stringify(lim));
  const no=R.rimOffsetSearch(-0.03,()=>false);assert.equal(no.offset,0);assert.ok(no.warnings.includes('KEPT_STOCK_POSITION'));
});

test('override (Parts Admin, metres inward) replaces the target, still checked',()=>{
  const o=R.rimOffsetSearch(0.025,()=>true,-0.01);assert.ok(close(o.offset,-0.01)&&o.warnings.includes('ADMIN_OVERRIDE'));
  assert.ok(close(R.rimOffsetSearch(null,()=>true,-0.01).offset,-0.01),'an override works without an arch line');
});

// a tyre: points on a short cylinder (radius 0.32, width 0.2) about `axis`, with uneven density (tread detail on one side only)
function tyre(axis){const [ax,ay,az]=axis,n=Math.hypot(ax,ay,az),a=[ax/n,ay/n,az/n],u=Math.abs(a[1])<0.9?[0,1,0]:[1,0,0];
  const cross=(p,q)=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]],norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
  const t=norm(cross(a,u)),b=cross(t,a),pts=[];
  for(let i=0;i<360;i++)for(let j=0;j<=10;j++){const th=i*Math.PI/180,w=-0.1+0.02*j,r=0.32;if(th>Math.PI&&j%3)continue; // fewer points on one half
    for(const rr of [r,r*0.7])pts.push([0,1,2].map(k=>a[k]*w+(t[k]*Math.cos(th)+b[k]*Math.sin(th))*rr));}
  return {a,pts};}
const angle=(p,q)=>Math.acos(Math.min(1,Math.abs(p[0]*q[0]+p[1]*q[1]+p[2]*q[2])/Math.hypot(...p)/Math.hypot(...q)))*180/Math.PI;

test('axle: straight, cambered and steered wheels, uneven point density',()=>{
  for(const axis of [[1,0,0],[-0.996,0.087,0],[Math.cos(0.26),0,Math.sin(0.26)],[-Math.cos(0.4),0.05,Math.sin(0.4)]]){
    const {a,pts}=tyre(axis),pca=R.rimPCA(pts),fine=R.rimNarrowestAxis(pts,pca.axis[0]);
    assert.ok(angle(fine,a)<0.15,`axis ${axis} -> ${fine} (${angle(fine,a).toFixed(3)} deg)`);
  }
});
