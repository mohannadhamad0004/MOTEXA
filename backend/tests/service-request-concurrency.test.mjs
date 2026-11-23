import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import routes from '../dist/routes/mechanic-service-requests.routes.js';
import {prisma} from '../dist/prisma.js';

test('Simultaneous workshop requests queue safely; only one active service per mechanic, including competing sessions',async()=>{
 const ids=[],requestIds=[],app=express();app.use(express.json());app.use('/api/service-requests',routes);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api/service-requests';
 async function user(role){const u=await prisma.user.create({data:{role,status:'ACTIVE',fullName:'Concurrency fixture',email:randomUUID()+'@concurrency.invalid',passwordHash:'not-a-login-fixture'}});ids.push(u.id);return {id:u.id,token:jwt.sign({sessionVersion:0},process.env.JWT_SECRET,{subject:u.id,algorithm:'HS256',expiresIn:'10m'})};}
 async function api(path,method,body,token){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};}
 async function create(owner,mechanic,title='Concurrent workshop request',mode='WORKSHOP'){return api('/','POST',{mechanicId:mechanic.id,clientRequestId:randomUUID(),mode,title,description:'Actual parallel HTTP request to the same workshop.',vehicle:'Toyota Corolla · 2018',contactNumber:'0599999999',address:mode==='ON_SITE'?'Fixture visit address':''},owner.token);}
 const action=(mechanic,r,kind,version=r.version,note='')=>api('/'+r.id+'/action','POST',{action:kind,version,note},mechanic.token);
 try{
  const c1=await user('CUSTOMER'),c2=await user('CUSTOMER'),m1=await user('MECHANIC'),m2=await user('MECHANIC');for(const m of [m1,m2])await prisma.mechanicProfile.create({data:{userId:m.id,verificationStatus:'VERIFIED',offersWorkshop:true,offersOnSite:true,offersOnline:true,specializations:['PETROL_ENGINES']}});
  const index=await prisma.$queryRaw`SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname='ServiceRequest_one_active_mechanic'`;assert.equal(index.length,1,'Database capacity invariant must be migrated');
  const incoming=await Promise.all([create(c1,m1),create(c2,m1)]);assert.deepEqual(incoming.map(r=>r.status),[201,201]);const pending=incoming.map(r=>r.body.request);requestIds.push(...pending.map(r=>r.id));assert.notEqual(pending[0].id,pending[1].id);assert.ok(pending.every(r=>r.status==='NEW'));assert.equal(await prisma.notification.count({where:{userId:m1.id,kind:'SERVICE_REQUEST_NEW'}}),2);
  const decisions=await Promise.all(pending.map(r=>action(m1,r,'ACCEPT')));assert.deepEqual(decisions.map(r=>r.status).sort(),[200,409]);const accepted=decisions.find(r=>r.status===200).body.request,blocked=decisions.find(r=>r.status===409);assert.equal(blocked.body.code,'MECHANIC_BUSY');const waiting=pending.find(r=>r.id!==accepted.id);assert.equal((await prisma.serviceRequest.findUnique({where:{id:waiting.id}})).status,'NEW');assert.equal((await prisma.serviceRequest.findUnique({where:{id:waiting.id}})).version,0);assert.equal(await prisma.auditLog.count({where:{targetId:{in:requestIds},action:'SERVICE_REQUEST_ACCEPT'}}),1);assert.equal(await prisma.notification.count({where:{userId:{in:[c1.id,c2.id]},kind:'SERVICE_REQUEST_ACCEPT'}}),1);
  assert.equal((await action(m1,accepted,'START')).status,200);const busy=await action(m1,waiting,'ACCEPT');assert.equal(busy.status,409);assert.equal(busy.body.code,'MECHANIC_BUSY');assert.equal((await prisma.serviceRequest.findUnique({where:{id:waiting.id}})).status,'NEW');
  for(const mode of ['ON_SITE','ONLINE']){const queued=await create(c2,m1,'Cross-mode capacity '+mode,mode);assert.equal(queued.status,201);requestIds.push(queued.body.request.id);const denied=await action(m1,queued.body.request,'ACCEPT');assert.equal(denied.status,409);assert.equal(denied.body.code,'MECHANIC_BUSY');assert.equal((await prisma.serviceRequest.findUnique({where:{id:queued.body.request.id}})).status,'NEW','Capacity is shared across workshop, mobile and online services');}
  const independent=(await create(c2,m2,'Independent workshop')).body.request;requestIds.push(independent.id);assert.equal((await action(m2,independent,'ACCEPT')).status,200,'Capacity is per mechanic, not global');
  const complete=await action(m1,accepted,'COMPLETE',2);assert.equal(complete.status,200);assert.equal((await action(m1,waiting,'ACCEPT')).status,200,'Completion releases capacity');
  await assert.rejects(prisma.serviceRequest.update({where:{id:accepted.id},data:{status:'ACCEPTED'}}),e=>e.code==='P2002','Direct writes cannot bypass the partial unique index');assert.equal((await prisma.serviceRequest.findUnique({where:{id:accepted.id}})).status,'COMPLETED');
  const contenders=await Promise.all([action(m1,waiting,'START',1),action(m1,waiting,'COMPLETE',1)]);assert.deepEqual(contenders.map(r=>r.status).sort(),[200,409]);assert.equal((await prisma.serviceRequest.findUnique({where:{id:waiting.id}})).status,'IN_PROGRESS');assert.equal(await prisma.auditLog.count({where:{targetId:waiting.id,action:'SERVICE_REQUEST_START'}}),1);
  const extra=(await create(c1,m1,'Pending despite busy workshop')).body.request;requestIds.push(extra.id);assert.equal(extra.status,'NEW');assert.equal((await api('/'+extra.id+'/cancel','POST',{version:0},c1.token)).status,200);assert.equal((await prisma.serviceRequest.findUnique({where:{id:extra.id}})).status,'CANCELLED');
  const feed=(await api('/customer','GET',undefined,c1.token)).body.requests;assert.ok(feed.length);assert.ok(feed.every(r=>r.customerId===c1.id));
 }finally{
  await prisma.notification.deleteMany({where:{OR:[{userId:{in:ids}},{relatedUserId:{in:ids}}]}});await prisma.auditLog.deleteMany({where:{OR:[{actorId:{in:ids}},{targetId:{in:requestIds}}]}});await prisma.serviceRequest.deleteMany({where:{OR:[{customerId:{in:ids}},{mechanicId:{in:ids}}]}});await prisma.user.deleteMany({where:{id:{in:ids}}});await new Promise(r=>server.close(r));await prisma.$disconnect();
 }
});
