import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import routes from '../dist/routes/mechanic-service-requests.routes.js';
import {prisma} from '../dist/prisma.js';

test('Service requests enforce ownership, approval, idempotency, transitions and private notifications',async()=>{
 const ids=[],requestIds=[],tag=randomUUID();const app=express();app.use(express.json());app.use('/api/service-requests',routes);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api/service-requests';
 async function user(role){const u=await prisma.user.create({data:{fullName:'Request fixture '+role,email:randomUUID()+'@requests.invalid',passwordHash:'isolated-fixture',role,status:'ACTIVE'}});ids.push(u.id);return {id:u.id,token:jwt.sign({sessionVersion:0},process.env.JWT_SECRET,{subject:u.id,algorithm:'HS256',expiresIn:'10m'})};}
 async function api(path,method,body,token){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
 try{
  const customer=await user('CUSTOMER'),otherCustomer=await user('CUSTOMER'),mechanic=await user('MECHANIC'),otherMechanic=await user('MECHANIC'),pending=await user('MECHANIC');
  for(const u of [mechanic,otherMechanic,pending])await prisma.mechanicProfile.create({data:{userId:u.id,specializations:['PETROL_ENGINES'],offersWorkshop:true,verificationStatus:u===pending?'PENDING':'VERIFIED'}});
  const payload={mechanicId:mechanic.id,clientRequestId:randomUUID(),mode:'WORKSHOP',title:'Check engine vibration',description:'Vibration occurs while the engine is idling.',vehicle:'Toyota Corolla 2016',contactNumber:'0599999999',address:''};
  assert.equal((await api('/mechanic','GET')).status,401);
  assert.equal((await api('/mechanic','GET',undefined,customer.token)).status,403);
  assert.equal((await api('/mechanic','GET',undefined,pending.token)).status,403);
  assert.equal((await api('/','POST',payload,mechanic.token)).status,403);
  assert.equal((await api('/','POST',{...payload,mechanicId:pending.id},customer.token)).status,403);
  assert.equal((await api('/','POST',{...payload,mode:'ONLINE'},customer.token)).status,400);
  assert.equal((await api('/','POST',{...payload,mode:'ON_SITE'},customer.token)).status,400);
  const created=await Promise.all([api('/','POST',payload,customer.token),api('/','POST',payload,customer.token)]);
  assert.deepEqual(created.map(r=>r.status),[201,201]);const request=created[0].body.request;requestIds.push(request.id);assert.equal(created[1].body.request.id,request.id);
  assert.equal(await prisma.notification.count({where:{userId:mechanic.id,kind:'SERVICE_REQUEST_NEW'}}),1,'Retries do not create duplicate invitations');
  assert.equal((await api('/','POST',{...payload,title:'Different work'},customer.token)).status,409);
  assert.equal(JSON.stringify(request).includes('passwordHash'),false);assert.equal(JSON.stringify(request).includes('@requests.invalid'),false);
  const mine=await api('/mechanic','GET',undefined,mechanic.token);assert.equal(mine.status,200);assert.equal(mine.body.requests[0].id,request.id);assert.equal(mine.body.counts.NEW,1);
  assert.equal((await api('/mechanic','GET',undefined,otherMechanic.token)).body.requests.length,0);
  const action='/'+request.id+'/action';
  assert.equal((await api(action,'POST',{action:'ACCEPT',version:0},otherMechanic.token)).status,404);
  assert.equal((await api(action,'POST',{action:'ACCEPT',version:0},customer.token)).status,403);
  assert.equal((await api(action,'POST',{action:'ACCEPT',version:99},mechanic.token)).status,409);
  assert.equal((await api(action,'POST',{action:'COMPLETE',version:0},mechanic.token)).status,409);
  const accepted=await Promise.all([api(action,'POST',{action:'ACCEPT',version:0},mechanic.token),api(action,'POST',{action:'ACCEPT',version:0},mechanic.token)]);
  assert.deepEqual(accepted.map(r=>r.status).sort(),[200,409]);assert.equal(await prisma.auditLog.count({where:{targetId:request.id,action:'SERVICE_REQUEST_ACCEPT'}}),1);
  assert.equal((await api('/'+request.id+'/cancel','POST',{version:1},customer.token)).status,409);
  assert.equal((await api(action,'POST',{action:'START',version:1},mechanic.token)).body.request.status,'IN_PROGRESS');
  assert.equal((await api(action,'POST',{action:'COMPLETE',version:2},mechanic.token)).body.request.status,'COMPLETED');
  assert.equal((await api(action,'POST',{action:'START',version:3},mechanic.token)).status,409);
  assert.equal((await api('/customer','GET',undefined,customer.token)).body.requests[0].status,'COMPLETED');
  assert.equal((await api('/customer','GET',undefined,otherCustomer.token)).body.requests.length,0);
  assert.equal((await api('/','POST',payload,customer.token)).body.request.id,request.id,'Completed request retries are still idempotent');
  const declined=(await api('/','POST',{...payload,clientRequestId:randomUUID()},customer.token)).body.request;requestIds.push(declined.id);
  assert.equal((await api('/'+declined.id+'/action','POST',{action:'DECLINE',version:0},mechanic.token)).status,400);
  const decline=await api('/'+declined.id+'/action','POST',{action:'DECLINE',version:0,note:'Outside the current workshop capacity.'},mechanic.token);assert.equal(decline.body.request.status,'DECLINED');assert.ok(decline.body.request.decisionNote);
  const cancelled=(await api('/','POST',{...payload,clientRequestId:randomUUID()},customer.token)).body.request;requestIds.push(cancelled.id);
  assert.equal((await api('/'+cancelled.id+'/cancel','POST',{version:0},otherCustomer.token)).status,404);
  assert.equal((await api('/'+cancelled.id+'/cancel','POST',{version:0},customer.token)).body.request.status,'CANCELLED');
  assert.equal((await api('/'+cancelled.id+'/action','POST',{action:'ACCEPT',version:0},mechanic.token)).status,409);
  await prisma.mechanicProfile.update({where:{userId:mechanic.id},data:{verificationStatus:'SUSPENDED'}});
  assert.equal((await api('/mechanic','GET',undefined,mechanic.token)).status,403);
  assert.equal((await api('/','POST',{...payload,clientRequestId:randomUUID()},customer.token)).status,403);
 }finally{
  await prisma.notification.deleteMany({where:{OR:[{userId:{in:ids}},{relatedUserId:{in:ids}}]}});
  await prisma.auditLog.deleteMany({where:{OR:[{actorId:{in:ids}},{targetId:{in:requestIds}}]}});
  await prisma.serviceRequest.deleteMany({where:{OR:[{customerId:{in:ids}},{mechanicId:{in:ids}}]}});
  await prisma.user.deleteMany({where:{id:{in:ids}}});
  await new Promise(r=>server.close(r));await prisma.$disconnect();
 }
});
