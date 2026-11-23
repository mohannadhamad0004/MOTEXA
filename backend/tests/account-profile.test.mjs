import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
process.env.JWT_SECRET='isolated-profile-test-secret-at-least-32-characters';
let data,failAudit=false;
function project(user,selection){return user?Object.fromEntries(Object.keys(selection).map(key=>[key,user[key]])):null;}
function delegates(state){return {user:{findUnique:async({where,select})=>project(state.users.find(user=>user.id===where.id),select),updateMany:async({where,data:change})=>{const user=state.users.find(user=>Object.entries(where).every(([key,value])=>user[key]===value));if(!user)return{count:0};Object.assign(user,change);return{count:1};}},auditLog:{create:async({data:log})=>{if(failAudit)throw Error('Isolated audit failure');state.logs.push(log);return log;}}};}
const db=new Proxy({}, {get:(_,key)=>key==='$transaction'?async callback=>{const staged=structuredClone(data);const result=await callback(delegates(staged));data=staged;return result;}:delegates(data)[key]});
mock.module(new URL('../dist/prisma.js',import.meta.url).href,{exports:{prisma:db}});
const {default:profile}=await import('../dist/routes/account-profile.routes.js');
test('Profile name update: own account, strict fields, validation, session enforcement and atomic audit',async()=>{
 data={users:[['super','SUPER_ADMIN','ACTIVE'],['admin','ADMIN','ACTIVE'],['mechanic','MECHANIC','ACTIVE'],['paused','ADMIN','SUSPENDED']].map(([id,role,status])=>({id,role,status,sessionVersion:0,fullName:'Original '+id,email:id+'@example.invalid',passwordHash:'never-return',adminPermissions:[]})),logs:[]};
 const app=express();app.use(express.json());app.use('/profile',profile);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 async function request(body,id='super',version=0){const token=jwt.sign({sessionVersion:version},process.env.JWT_SECRET,{subject:id||'none',algorithm:'HS256',expiresIn:'5m'});const response=await fetch('http://127.0.0.1:'+server.address().port+'/profile',{method:'PATCH',headers:{'Content-Type':'application/json',...(id?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};}
 try{
  assert.equal((await request({fullName:'New name'},null)).status,401);assert.equal((await request({fullName:'New name'},'mechanic')).status,403);assert.equal((await request({fullName:'New name'},'paused')).status,403);assert.equal((await request({fullName:'New name'},'admin',1)).status,401);
  for(const body of [{fullName:'x'},{fullName:'x'.repeat(121)},{fullName:'bad\u0000name'},{fullName:'New name',role:'SUPER_ADMIN'},{fullName:'New name',email:'other@example.invalid'},{fullName:'New name',status:'ACTIVE'},{fullName:'New name',id:'admin'},[]])assert.equal((await request(body)).status,400);
  const result=await request({fullName:'  Updated   Name  '});assert.equal(result.status,200);assert.equal(result.body.user.fullName,'Updated Name');assert.equal(data.users.find(u=>u.id==='super').fullName,'Updated Name');assert.equal(data.users.find(u=>u.id==='admin').fullName,'Original admin');assert.equal(data.logs.at(-1).action,'ADMIN_PROFILE_UPDATED');assert.equal(data.logs.at(-1).actorId,'super');assert(!JSON.stringify(result.body).includes('never-return'));assert(!('sessionVersion'in result.body.user));
  failAudit=true;assert.equal((await request({fullName:'Must roll back'})).status,500);failAudit=false;assert.equal(data.users.find(u=>u.id==='super').fullName,'Updated Name');assert.equal(data.logs.length,1);
  assert.equal((await request({fullName:'الاسم الجديد'},'admin')).status,200);assert.equal(data.users.find(u=>u.id==='admin').fullName,'الاسم الجديد');
 }finally{server.close();server.closeAllConnections();}
});
