import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarageStore, canAddGarageCar, matchingGarageCars } from '../src/features/catalog/garageStore.ts';
import { modelFor } from '../src/features/car3d/models.ts';

const car = (id, isActive = false, extra = {}) => ({ id, make: 'Toyota', model: 'Corolla', year: 2018, nickname: null, color: null, generationId: null, generation: null, isActive, lastSelectedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', ...extra });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
function harness(initial = [car('a', true), car('b', false, {model:'Niro'})]) {
  let rows = initial, reads = 0, creates = 0;
  const api = {
    async getGarage() { reads++; return structuredClone(rows); },
    async addGarageCar(input) { creates++; const saved=car(`new-${creates}`, !rows.length, input); rows=[...rows,saved]; return saved; },
    async updateGarageCar(id,input) { rows=rows.map(c=>c.id===id?{...c,...input}:c); return rows.find(c=>c.id===id); },
    async activateGarageCar(id) { rows=rows.map(c=>({...c,isActive:c.id===id})); return rows.find(c=>c.id===id); },
    async deleteGarageCar(id) { const active=rows.find(c=>c.id===id)?.isActive; rows=rows.filter(c=>c.id!==id); if(active && rows.length) rows[0]={...rows[0],isActive:true}; },
  };
  return { api, store:createGarageStore(api), reads:()=>reads, creates:()=>creates };
}
test('hydration deduplicates reads and derives active regardless of array position', async()=>{
  const h=harness([car('b'),car('a',true)]);
  await Promise.all([h.store.hydrate('u'),h.store.hydrate('u')]);
  assert.equal(h.reads(),1); assert.equal(h.store.getSnapshot().activeCar.id,'a'); assert.equal(h.store.getSnapshot().activeCar.year,'2018');
  assert.equal(h.store.getSnapshot(),h.store.getSnapshot());
});
test('selector activation updates the same active snapshot used by legacy currentCar and Parts', async()=>{
  const h=harness(); await h.store.hydrate('u');
  const currentCar=()=>h.store.getSnapshot().activeCar;
  await h.store.activate('b'); assert.equal(currentCar().id,'b'); assert.equal(currentCar().model,'Niro');
  assert.equal(h.creates(),0); assert.equal(h.store.getSnapshot().garageCars.filter(c=>c.isActive).length,1);
});
test('add is inactive, duplicate add prevented, editing affects only target', async()=>{
  const h=harness(); await h.store.hydrate('u');
  await h.store.add({make:'Kia',model:'Sportage',year:2021});
  assert.equal(h.store.getSnapshot().activeCar.id,'a');
  await assert.rejects(h.store.add({make:'Kia',model:'Sportage',year:2021}),/ALREADY_SAVED/);
  assert.equal(h.creates(),1);
  await h.store.update('b',{nickname:'Family'}); assert.equal(h.store.getSnapshot().garageCars[0].nickname,null);
});
test('deleting inactive preserves active; deleting active accepts backend promotion; final delete empties', async()=>{
  const h=harness([car('a',true),car('b'),car('c')]); await h.store.hydrate('u');
  await h.store.remove('c'); assert.equal(h.store.getSnapshot().activeCar.id,'a');
  await h.store.remove('a'); assert.equal(h.store.getSnapshot().activeCar.id,'b');
  await h.store.remove('b'); assert.equal(h.store.getSnapshot().activeCar,null); assert.deepEqual(h.store.getSnapshot().garageCars,[]);
});
test('ten-car UI gate reopens after deletion; updates and activation remain available', async()=>{
  const h=harness(Array.from({length:10},(_,i)=>car(String(i),!i))); await h.store.hydrate('u');
  assert.equal(canAddGarageCar(h.store.getSnapshot().garageCars),false);
  await assert.rejects(h.store.add({make:'Kia',model:'New',year:2021}),/LIMIT_REACHED/);
  await h.store.activate('3'); await h.store.update('3',{nickname:'Daily'}); await h.store.remove('0');
  assert.equal(canAddGarageCar(h.store.getSnapshot().garageCars),true);
});
test('saved search matches normalize names and respect explicit generation choice',()=>{
  const rows=[car('a',true,{generationId:'g'}),car('b')];
  assert.equal(matchingGarageCars(rows,{make:' TOYOTA ',model:'corolla',year:'2018'}).length,2);
  assert.equal(matchingGarageCars(rows,{make:'Toyota',model:'Corolla',year:2018,generationId:null})[0].id,'b');
});
test('refresh retains valid active car while loading and on failure, then can retry',async()=>{
  const h=harness(); await h.store.hydrate('u'); const gate=deferred(); h.api.getGarage=()=>gate.promise;
  const p=h.store.refresh(); assert.equal(h.store.getSnapshot().activeCar.id,'a');
  gate.reject(Error('offline')); await p; assert.equal(h.store.getSnapshot().activeCar.id,'a'); assert.equal(h.store.getSnapshot().error,'offline');
  h.api.getGarage=async()=>[]; await h.store.refresh(); assert.equal(h.store.getSnapshot().activeCar,null);
});
test('account switch ignores old hydration and clears previous owner immediately',async()=>{
  const h=harness(); const gate=deferred(); h.api.getGarage=()=>gate.promise;
  const old=h.store.hydrate('old'); h.api.getGarage=async()=>[car('new',true)]; await h.store.hydrate('new');
  gate.resolve([car('old',true)]); await old; assert.equal(h.store.getSnapshot().activeCar.id,'new');
  h.store.reset(null); assert.equal(h.store.getSnapshot().activeCar,null);
});
test('late write from previous account cannot refresh or alter new account',async()=>{
  const h=harness(); await h.store.hydrate('old'); const gate=deferred(); h.api.activateGarageCar=()=>gate.promise;
  const old=h.store.activate('b'); h.api.getGarage=async()=>[car('new',true)]; await h.store.hydrate('new');
  gate.resolve(car('b',true)); await old; assert.equal(h.store.getSnapshot().activeCar.id,'new');
});
test('overlapping writes rejected; stale refresh cannot overwrite activation',async()=>{
  const h=harness(); await h.store.hydrate('u'); const gate=deferred(); h.api.getGarage=()=>gate.promise;
  const old=h.store.refresh(); h.api.getGarage=async()=>[car('b',true)];
  const change=h.store.activate('b'); await assert.rejects(h.store.activate('a'),/BUSY/); await change;
  gate.resolve([car('a',true)]); await old; assert.equal(h.store.getSnapshot().activeCar.id,'b');
});
test('successful add followed by failed refresh remains recorded and cannot duplicate',async()=>{
  const h=harness([]); await h.store.hydrate('u'); h.api.getGarage=async()=>{throw Error('offline');};
  await h.store.add({make:'Kia',model:'Niro',year:2021}); assert.equal(h.store.getSnapshot().garageCars.length,1);
  await assert.rejects(h.store.add({make:'Kia',model:'Niro',year:2021}),/ALREADY_SAVED/);
});
test('activation persists into a fresh store and selecting current car signals Parts to end a preview',async()=>{
  const h=harness(); await h.store.hydrate('u'); await h.store.activate('b');
  const restored=createGarageStore(h.api); await restored.hydrate('u'); assert.equal(restored.getSnapshot().activeCar.id,'b');
  const version=restored.getSnapshot().selectionRevision; await restored.activate('b'); assert.equal(restored.getSnapshot().selectionRevision,version+1); assert.equal(h.creates(),0);
});
test('active generation resolves Corolla model, coming soon, then correct Corolla again',async()=>{
  const h=harness([car('corolla',true,{generation:{id:'g',model3dKey:'toyota-corolla-e170-e180'}}),car('unknown',false,{model:'Other',generation:null})]);
  await h.store.hydrate('u'); assert.equal(modelFor(h.store.getSnapshot().activeCar)?.key,'toyota-corolla-e170-e180');
  await h.store.activate('unknown'); assert.equal(modelFor(h.store.getSnapshot().activeCar),null);
  await h.store.activate('corolla'); assert.equal(modelFor(h.store.getSnapshot().activeCar)?.key,'toyota-corolla-e170-e180');
});
test('lost POST response reconciles committed car before retry to prevent duplicates',async()=>{
  const h=harness([]); await h.store.hydrate('u'); const add=h.api.addGarageCar;
  h.api.addGarageCar=async(input)=>{await add(input);throw Error('response lost');};
  const input={make:'Kia',model:'Niro',year:2021};
  await assert.rejects(h.store.add(input),/response lost/);
  assert.equal(h.store.getSnapshot().garageCars.length,1);
  await assert.rejects(h.store.add(input),/ALREADY_SAVED/); assert.equal(h.creates(),1);
});
