import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import {parseServiceConfig,serviceModeFilter} from '../dist/services/mechanic-services.js';
process.env.JWT_SECRET='isolated-mechanic-service-paths-test-secret';
let state;
function matches(row,where={}){return Object.entries(where).every(([key,value])=>{if(value&&typeof value==='object'){if('not'in value)return row[key]!==value.not;}return row[key]===value;});}
function select(row,fields){if(!row)return null;return fields?Object.fromEntries(Object.keys(fields).map(key=>[key,row[key]])):structuredClone(row);}
function delegates(data){return{
 $queryRawUnsafe:async()=>[],
 user:{findUnique:async({where,select:fields})=>select(data.users.find(u=>matches(u,where)),fields),findUniqueOrThrow:async({where,select:fields})=>select(data.users.find(u=>matches(u,where)),fields)},
 adminPermission:{findUnique:async({where})=>where.adminId_permission.adminId==='reviewer'?{permission:'MANAGE_MECHANICS'}:null},
 mechanicProfile:{findUnique:async({where,select:fields})=>{const row=data.profiles.find(p=>matches(p,where));return fields?select(row?{...row,user:{status:data.users.find(u=>u.id===row.userId)?.status}}:null,fields):row?{...structuredClone(row),user:select(data.users.find(u=>u.id===row.userId),{id:true,fullName:true,email:true,status:true})}:null;},findFirst:async({where})=>data.profiles.find(p=>matches(p,where))??null,findMany:async({where={},select:fields,take=100,cursor,skip=0})=>{let rows=data.profiles.filter(p=>matches(p,where)).sort((a,b)=>b.submittedAt-a.submittedAt||b.id.localeCompare(a.id));if(cursor)rows=rows.slice(rows.findIndex(p=>p.id===cursor.id)+skip);return rows.slice(0,take).map(p=>select({...p,user:select(data.users.find(u=>u.id===p.userId),{id:true,fullName:true,email:true,status:true})},fields));},count:async({where})=>data.profiles.filter(p=>matches(p,where)).length,groupBy:async({where})=>{const counts={};data.profiles.filter(p=>matches(p,where)).forEach(p=>counts[p.verificationStatus]=(counts[p.verificationStatus]??0)+1);return Object.entries(counts).map(([verificationStatus,n])=>({verificationStatus,_count:{_all:n}}));},update:async({where,data:change})=>{const p=data.profiles.find(p=>matches(p,where));for(const[key,value]of Object.entries(change))p[key]=value&&typeof value==='object'&&'increment'in value?p[key]+value.increment:value;return p;}},
 mechanicTest:{findMany:async()=>[]},mechanicDocumentReview:{findMany:async()=>[]},
 auditLog:{findMany:async()=>[],create:async({data:log})=>{data.logs.push(log);return log;}},notification:{create:async()=>({})}
};}
const prisma=new Proxy({}, {get:(_,key)=>key==='$transaction'?async callback=>{const staged=structuredClone(state);const result=await callback(delegates(staged));state=staged;return result;}:delegates(state)[key]});
mock.module(new URL('../dist/prisma.js',import.meta.url).href,{exports:{prisma}});
mock.module(new URL('../dist/routes/mechanic-workflow.routes.js',import.meta.url).href,{exports:{notifyAdmins:async()=>{}}});
const {default:mechanics}=await import('../dist/routes/mechanics.routes.js');
test('Service config rejects wrong types, supports incomplete drafts and preserves future multi-service data',()=>{
 assert.equal(parseServiceConfig({offersWorkshop:'true'}).ok,false);assert.equal(parseServiceConfig({coverageAreas:['x'.repeat(81)]}).ok,false);assert.equal(parseServiceConfig({coverageAreas:Array(31).fill('City')}).ok,false);assert.equal(parseServiceConfig({workshopName:'x'.repeat(121)}).ok,false);
 assert.deepEqual(parseServiceConfig({offersWorkshop:true,coverageAreas:[' Nablus ','Nablus','']}),{ok:true,value:{offersWorkshop:true,offersOnSite:false,offersOnline:false,workshopName:'',workshopAddress:'',coverageAreas:['Nablus']}});
 assert.equal(parseServiceConfig({offersWorkshop:true,offersOnline:true}).ok,true);assert.equal(serviceModeFilter(['WORKSHOP']),null);assert.equal(serviceModeFilter('UNKNOWN'),null);
});
test('Workshop path persists, requires proof to submit, reaches the admin filter and remains approval-gated',async()=>{
 state={users:[['mechanic','MECHANIC'],['reviewer','ADMIN'],['wrong','ADMIN'],['site','MECHANIC'],['online','MECHANIC']].map(([id,role])=>({id,role,status:'ACTIVE',sessionVersion:0,fullName:'Fixture '+id,email:id+'@example.invalid'})),profiles:[{id:'draft',userId:'mechanic',verificationStatus:'DRAFT',submittedAt:null,submissionVersion:0,documents:[{kind:'IDENTITY'},{kind:'CERTIFICATE'}],tests:[]},{id:'site-profile',userId:'site',offersWorkshop:false,offersOnSite:true,offersOnline:false,verificationStatus:'PENDING',submittedAt:new Date(0),submissionVersion:1,documents:[],tests:[]},{id:'online-profile',userId:'online',offersWorkshop:false,offersOnSite:false,offersOnline:true,verificationStatus:'PENDING',submittedAt:new Date(0),submissionVersion:1,documents:[],tests:[]}],logs:[]};
 const app=express();app.use(express.json());app.use('/api/mechanics',mechanics);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 async function api(path,method='GET',body,id='mechanic'){const token=jwt.sign({sessionVersion:0},process.env.JWT_SECRET,{subject:id,algorithm:'HS256',expiresIn:'5m'});const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/mechanics'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()};}
 try{
 const body={city:'Nablus',phoneNumber:'0599999999',yearsOfExperience:6,experienceSummary:'Experienced workshop mechanic.',specializations:['PETROL_ENGINES'],offersWorkshop:true,offersOnSite:false,offersOnline:false,workshopName:' Workshop One ',workshopAddress:' Nablus, main road ',coverageAreas:[]};
 assert.equal((await api('/me','PUT',{...body,offersWorkshop:'true'})).status,400);assert.equal((await api('/me','PUT',body)).status,200);const saved=await api('/me');assert.equal(saved.body.profile.workshopName,'Workshop One');assert.equal(saved.body.profile.offersWorkshop,true);assert.equal(saved.body.profile.offersOnSite,false);assert.equal(saved.body.profile.canReceiveServices,false);
 const draftTotals=await api('/admin?mode=WORKSHOP','GET',null,'reviewer');
 assert.equal(draftTotals.status,200);assert.equal(draftTotals.body.totalMechanics,3);assert.deepEqual(draftTotals.body.registeredServiceCounts,{WORKSHOP:1,ON_SITE:1,ONLINE:1});assert.deepEqual(draftTotals.body.profiles,[]);
 state.profiles.push({id:'multi-draft-count-only',userId:'count-only',submittedAt:null,verificationStatus:'DRAFT',offersWorkshop:true,offersOnSite:false,offersOnline:true,documents:[],tests:[]});
 const overlapping=await api('/admin?mode=WORKSHOP','GET',null,'reviewer');assert.equal(overlapping.body.totalMechanics,4);assert.deepEqual(overlapping.body.registeredServiceCounts,{WORKSHOP:2,ON_SITE:1,ONLINE:2});assert.equal(overlapping.body.profiles.length,0);state.profiles.pop();

 assert.equal((await api('/me/submit','POST',{acceptPrivacy:true})).status,400);state.profiles.find(p=>p.id==='draft').documents.push({kind:'WORKSHOP_PROOF'});assert.equal((await api('/me/submit','POST',{acceptPrivacy:true})).status,200);assert.equal((await api('/me','PUT',body)).status,409);assert.equal((await api('/me/service-access')).status,403);const progress=await api('/me/progress');assert.equal(progress.status,200);assert.equal(progress.body.progress.stage,'ADMIN_REVIEW');assert.equal(progress.body.progress.canReceiveServices,false);assert(!JSON.stringify(progress.body).includes('storageKey'));assert.equal((await api('/me/progress','GET',null,'reviewer')).status,403);
 assert.equal((await api('/admin?mode=WORKSHOP','GET',null,'wrong')).status,403);assert.equal((await api('/admin?mode=BAD','GET',null,'reviewer')).status,400);const workshop=await api('/admin?mode=WORKSHOP','GET',null,'reviewer');assert.equal(workshop.status,200);assert.deepEqual(workshop.body.profiles.map(p=>p.userId),['mechanic']);assert.deepEqual(workshop.body.serviceCounts,{WORKSHOP:1,ON_SITE:1,ONLINE:1});for(const[mode,id]of[['ON_SITE','site'],['ONLINE','online']]){const r=await api('/admin?mode='+mode,'GET',null,'reviewer');assert.deepEqual(r.body.profiles.map(p=>p.userId),[id]);}
 assert.equal((await api('/admin/mechanic','GET',null,'reviewer')).body.profile.workshopAddress,'Nablus, main road');assert.equal(state.logs.at(-1).action,'MECHANIC_SUBMITTED');
 }finally{server.close();server.closeAllConnections();}
});
