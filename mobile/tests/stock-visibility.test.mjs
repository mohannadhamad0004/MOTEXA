import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Execute the shipped viewer's kitApply against stock objects with mixed visibility.
// Fitting/rendering is covered separately by the offline real-viewer suites.
const exports={};
new Function('exports',ts.transpileModule(readFileSync('src/features/car3d/sceneHtml.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText)(exports);
const html=exports.CAR3D_HTML;
const applySource=html.slice(html.indexOf('function addAdj('),html.indexOf('// ---- zone preview'));
function viewer(buildAccessory=()=>Promise.reject(Error('fixture load failure'))){
  const car={accs:{},accP:{},accFail:{},group:{remove(){},add(){}},acc:null},messages=[];
  const runtime=new Function('initial','KIT','assets','buildAccessory','post',applySource+'; var car=initial,state={kits:[]}; return {apply(kits){state={kits};kitApply(state);},changeCar(next){car=next;}};')(
    car,{FRONT_BUMPER:{},REAR_BUMPER:{}},{'pending.glb':true},buildAccessory,m=>messages.push(m));
  const attach=(type,file,objects)=>{
    car.accs[type+'|'+file]={group:{},zone:{hide:objects},place:[],mats:[]};
    return {type,file};
  };
  return {car,attach,messages,...runtime};
}

test('accessory OFF restores each stock object exactly, including objects hidden before ON',()=>{
  const v=viewer(),visible={visible:true},invisible={visible:false};
  const part=v.attach('REAR_BUMPER','rear.glb',[visible,invisible]);
  v.apply([part]);v.apply([part]);
  assert.deepEqual([visible.visible,invisible.visible],[false,false]);
  v.apply([]);
  assert.deepEqual([visible.visible,invisible.visible],[true,false]);
  assert.equal(v.car.stockVisibility.has(visible),false);
  assert.equal(v.car.stockVisibility.has(invisible),false);
  // Visibility changed by another viewer feature between cycles is the new baseline.
  visible.visible=false;invisible.visible=true;
  v.attach('REAR_BUMPER','rear.glb',[visible,invisible]);v.apply([part]);v.apply([]);
  assert.deepEqual([visible.visible,invisible.visible],[false,true]);
});

test('overlapping replacements keep stock hidden until the last accessory is OFF',()=>{
  const v=viewer(),shared={visible:true},originallyHidden={visible:false};
  const front=v.attach('FRONT_BUMPER','front.glb',[shared,originallyHidden]);v.apply([front]);
  const rear=v.attach('REAR_BUMPER','rear.glb',[shared,originallyHidden]);v.apply([front,rear]);
  v.apply([rear]);
  assert.deepEqual([shared.visible,originallyHidden.visible],[false,false]);
  v.apply([]);
  assert.deepEqual([shared.visible,originallyHidden.visible],[true,false]);
});

test('independent body-kit bumpers restore only their own stock objects',()=>{
  const v=viewer(),frontStock={visible:true},rearStock={visible:false};
  const front=v.attach('FRONT_BUMPER','front.glb',[frontStock]);
  const rear=v.attach('REAR_BUMPER','rear.glb',[rearStock]);
  v.apply([front,rear]);v.apply([rear]);
  assert.deepEqual([frontStock.visible,rearStock.visible],[true,false]);
  v.apply([]);
  assert.deepEqual([frontStock.visible,rearStock.visible],[true,false]);
});

test('a failed accessory load cannot release another replacement or change the stock baseline',async()=>{
  const v=viewer(),stock={visible:true},hidden={visible:false};
  const front=v.attach('FRONT_BUMPER','front.glb',[stock,hidden]);
  const rear={type:'REAR_BUMPER',file:'pending.glb'};
  v.apply([front,rear]);await Promise.resolve();v.apply([front,rear]);
  assert.equal(v.car.accFail['REAR_BUMPER|pending.glb'],true);
  assert.deepEqual(v.messages.map(m=>m.type),['fitError']);
  assert.deepEqual([stock.visible,hidden.visible],[false,false]);
  v.apply([]);assert.deepEqual([stock.visible,hidden.visible],[true,false]);
});

test('a late load from the previous car cannot attach or hide stock on the new car',async()=>{
  let complete;const v=viewer(()=>new Promise(resolve=>{complete=resolve;}));
  const oldStock={visible:true},newStock={visible:false};
  const front=v.attach('FRONT_BUMPER','front.glb',[oldStock]);
  v.apply([front,{type:'REAR_BUMPER',file:'pending.glb'}]);
  const next={accs:{},accP:{},accFail:{},group:{remove(){},add(){assert.fail('stale accessory attached');}},acc:null};
  v.changeCar(next);v.apply([]);
  complete({group:{},zone:{hide:[newStock]},place:[],mats:[]});await Promise.resolve();
  assert.deepEqual(Object.keys(next.accs),[]);assert.equal(next.stockHidden.size,0);
  assert.equal(newStock.visible,false);assert.deepEqual(v.messages,[]);
});
