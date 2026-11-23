import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

// This suite never opens a database connection and never sends an email.
process.env.JWT_SECRET='isolated-control-center-test-secret';
process.env.ADMIN_ACTIVATION_URL='https://example.invalid/activate';
let state,failAudit=false,failMail=false,mailCalls=[];
const stamp=()=>new Date();
function matches(item,where={}){
 return Object.entries(where).every(([key,value])=>{
  if(key==='OR')return value.some(condition=>matches(item,condition));
  if(value&&typeof value==='object'&&!(value instanceof Date)){
   if('in' in value)return value.in.includes(item[key]);
   if('startsWith' in value)return item[key].startsWith(value.startsWith);
   if('gt' in value)return item[key]>value.gt;
   if('lte' in value)return item[key]<=value.lte;
  }
  return item[key]===value;
 });
}
function select(item,fields){if(!item)return null;if(!fields)return structuredClone(item);return Object.fromEntries(Object.keys(fields).filter(key=>fields[key]).map(key=>[key,item[key]]));}
function delegates(data){return {
 user:{count:async({where})=>data.users.filter(u=>matches(u,where)).length,findUnique:async({where,select:fields})=>select(data.users.find(u=>matches(u,where)),fields),findMany:async({where,select:fields}={})=>data.users.filter(u=>matches(u,where)).map(u=>select(u,fields)),updateMany:async({where,data:change})=>{const rows=data.users.filter(u=>matches(u,where));rows.forEach(u=>{for(const [key,value]of Object.entries(change))u[key]=value&&typeof value==='object'&&'increment'in value?u[key]+value.increment:value;});return{count:rows.length};}},
 mechanicProfile:{count:async()=>2},
 adminInvitation:{count:async({where})=>data.invitations.filter(i=>matches(i,where)).length,findFirst:async({where})=>data.invitations.find(i=>matches(i,where))??null,findUnique:async({where,select:fields})=>select(data.invitations.find(i=>matches(i,where)),fields),findMany:async({where,select:fields}={})=>data.invitations.filter(i=>matches(i,where)).map(i=>select(i,fields)),create:async({data:values})=>{const row={...values,id:randomUUID(),status:'PENDING',createdAt:stamp()};data.invitations.push(row);return row;},delete:async({where})=>{const row=data.invitations.find(i=>matches(i,where));data.invitations=data.invitations.filter(i=>!matches(i,where));return row;},updateMany:async({where,data:change})=>{const rows=data.invitations.filter(i=>matches(i,where));rows.forEach(i=>Object.assign(i,change));return{count:rows.length};}},
 auditLog:{create:async({data:values})=>{if(failAudit)throw Error('Isolated audit failure');const row={...values,id:randomUUID(),createdAt:new Date(Date.now()+data.logs.length)};data.logs.push(row);return row;},findMany:async({where,take,cursor,skip=0,select:fields})=>{let rows=data.logs.filter(i=>matches(i,where)).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));if(cursor){const index=rows.findIndex(i=>i.id===cursor.id);rows=index<0?[]:rows.slice(index+skip);}return rows.slice(0,take).map(i=>select(i,fields));}},
};}
const database=new Proxy({}, {get:(_,key)=>key==='$transaction'?async callback=>{const copy=structuredClone(state);const result=await callback(delegates(copy));state=copy;return result;}:delegates(state)[key]});
mock.module(new URL('../dist/prisma.js',import.meta.url).href,{namedExports:{prisma:database}});
mock.module(new URL('../dist/services/email.service.js',import.meta.url).href,{namedExports:{sendAdminInvitationEmail:async message=>{mailCalls.push(message);if(failMail)throw Error('Isolated mail failure');}}});
const {default:administration}=await import('../dist/routes/admin.routes.js');
const {default:invitations}=await import('../dist/routes/admin-invitations.routes.js');

test('Super Admin control center: authorization, real counts, redaction, pagination and atomic audit records',async()=>{
 const users=[['super','SUPER_ADMIN','ACTIVE'],['department','ADMIN','ACTIVE'],['paused','ADMIN','SUSPENDED'],['mechanic','MECHANIC','ACTIVE'],['parts','PARTS_PROVIDER','ACTIVE'],['tow','TOW_PROVIDER','ACTIVE']].map(([id,role,status])=>({id,role,status,fullName:'Fixture '+id,email:id+'@example.invalid',sessionVersion:0,createdAt:stamp()}));
 const invitation=(id,expiresAt)=>({id,email:id+'@example.invalid',fullName:'Invitation '+id,permission:'MANAGE_TOWING',status:'PENDING',expiresAt,createdAt:stamp()});
 state={users,invitations:[invitation('pending',new Date(Date.now()+60000)),invitation('expired',new Date(Date.now()-60000))],logs:[{id:randomUUID(),actorId:'super',targetId:'mechanic',action:'MECHANIC_REVIEWED',createdAt:new Date(0),details:{fullName:'Fixture mechanic',token:'never-return',passwordHash:'never-return',privateNotes:'never-return'}}]};
 const app=express();app.use(express.json());app.use('/api/admin-management',administration);app.use('/api/admin-invitations',invitations);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const token=id=>jwt.sign({sessionVersion:0},process.env.JWT_SECRET,{subject:id,algorithm:'HS256',expiresIn:'10m'});
 const api=async(path,method='GET',body,id='super')=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(id?{Authorization:'Bearer '+token(id)}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()};};
 try{
  assert.equal((await api('/api/admin-management/dashboard','GET',null,null)).status,401);
  assert.equal((await api('/api/admin-management/activity','GET',null,'department')).status,403);
  const summary=await api('/api/admin-management/dashboard');assert.equal(summary.status,200);assert.deepEqual(summary.body.stats,{administrators:1,mechanics:1,pendingMechanics:2,pendingInvitations:1,partsProviders:1,towProviders:1,suspendedAdministrators:1,expiredInvitations:1});
  for(const query of ['limit=0','limit=21','limit=abc','cursor=invalid','limit=1&limit=2'])assert.equal((await api('/api/admin-management/activity?'+query)).status,400);
  const create=await api('/api/admin-invitations','POST',{email:'new@example.invalid',fullName:'New administrator',permission:'MANAGE_SPARE_PARTS'});assert.equal(create.status,201);assert.equal(mailCalls.length,1);assert(!JSON.stringify(create.body).includes('tokenHash'));assert.equal(state.logs.at(-1).action,'ADMIN_INVITATION_CREATED');assert.equal(state.logs.at(-1).actorId,'super');
  assert.equal((await api('/api/admin-invitations','POST',{email:'new@example.invalid',fullName:'Duplicate',permission:'MANAGE_SPARE_PARTS'})).status,409);
  failMail=true;const failed=await api('/api/admin-invitations','POST',{email:'failure@example.invalid',fullName:'Mail failure',permission:'MANAGE_TOWING'});failMail=false;assert.equal(failed.status,502);assert(!state.invitations.some(i=>i.email==='failure@example.invalid'));assert.equal(state.logs.at(-1).action,'ADMIN_INVITATION_DELIVERY_FAILED');
  assert.equal((await api('/api/admin-invitations/department/status','PATCH',{status:'SUSPENDED'})).status,200);assert.equal(state.users.find(u=>u.id==='department').status,'SUSPENDED');assert.equal(state.logs.at(-1).action,'ADMIN_ACCOUNT_SUSPENDED');let logs=state.logs.length;
  assert.equal((await api('/api/admin-invitations/department/status','PATCH',{status:'SUSPENDED'})).status,409);assert.equal(state.logs.length,logs);
  assert.equal((await api('/api/admin-invitations/department/status','PATCH',{status:'ACTIVE'})).status,200);assert.equal(state.logs.at(-1).action,'ADMIN_ACCOUNT_REACTIVATED');assert.equal(state.users.find(u=>u.id==='department').sessionVersion,2);assert.equal((await api('/api/admin-management/activity','GET',null,'department')).status,401);logs=state.logs.length;
  failAudit=true;assert.equal((await api('/api/admin-invitations/department/status','PATCH',{status:'SUSPENDED'})).status,500);failAudit=false;assert.equal(state.users.find(u=>u.id==='department').status,'ACTIVE');assert.equal(state.logs.length,logs);
  assert.equal((await api('/api/admin-invitations/super/status','PATCH',{status:'SUSPENDED'})).status,409);assert.equal(state.users.find(u=>u.id==='super').status,'ACTIVE');
  assert.equal((await api('/api/admin-invitations/pending/revoke','PATCH')).status,200);assert.equal(state.logs.at(-1).action,'ADMIN_INVITATION_REVOKED');logs=state.logs.length;assert.equal((await api('/api/admin-invitations/pending/revoke','PATCH')).status,404);assert.equal(state.logs.length,logs);
  for(const scope of ['administrators','mechanics']){const filtered=await api('/api/admin-management/activity?limit=20&scope='+scope);assert.equal(filtered.status,200);assert(filtered.body.activity.length>0);assert(filtered.body.activity.every(row=>row.action.startsWith(scope==='administrators'?'ADMIN_':'MECHANIC_')));}
  for(const scope of ['parts','towing']){const response=await api('/api/admin-management/activity?scope='+scope);assert.equal(response.status,200);assert.deepEqual(response.body.activity,[]);}
  assert.equal((await api('/api/admin-management/activity?scope=invalid')).status,400);
  const first=await api('/api/admin-management/activity?limit=2');assert.equal(first.status,200);assert.equal(first.body.activity.length,2);assert(first.body.nextCursor);const second=await api('/api/admin-management/activity?limit=2&cursor='+first.body.nextCursor);assert.equal(second.status,200);assert(second.body.activity.every(row=>!first.body.activity.some(previous=>previous.id===row.id)));
  const all=await api('/api/admin-management/activity?limit=20');assert(!JSON.stringify(all.body).includes('never-return'));assert(all.body.activity.some(row=>row.subjectName==='Fixture mechanic'));assert(all.body.activity.every(row=>!('details'in row)&&!('actorId'in row)));
 }finally{server.close();await new Promise(resolve=>server.closeAllConnections? (server.closeAllConnections(),resolve()):resolve());}
});
