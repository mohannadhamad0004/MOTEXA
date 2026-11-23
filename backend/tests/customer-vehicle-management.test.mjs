import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import routes from '../dist/routes/customer.routes.js';
import requestRoutes from '../dist/routes/mechanic-service-requests.routes.js';
import {prisma} from '../dist/prisma.js';

test('Saved garage selection, edits, removal and request snapshots persist with owner and version checks',async()=>{
 const ids=[],requestIds=[],app=express();app.use(express.json());app.use('/api/customer',routes);app.use('/api/service-requests',requestRoutes);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 async function user(role){const u=await prisma.user.create({data:{fullName:'Premium fixture',email:randomUUID()+'@premium.invalid',role,status:'ACTIVE',passwordHash:'fixture-only'}});ids.push(u.id);return {id:u.id,token:jwt.sign({sessionVersion:0},process.env.JWT_SECRET,{subject:u.id,algorithm:'HS256',expiresIn:'10m'})};}
 async function api(path,method='GET',body,token){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
 try{
  const owner=await user('CUSTOMER'),other=await user('CUSTOMER'),mechanic=await user('MECHANIC');await prisma.mechanicProfile.create({data:{userId:mechanic.id,specializations:['PETROL_ENGINES'],verificationStatus:'VERIFIED',offersWorkshop:true,workshopName:'Premium fixture garage',city:'Nablus',experienceSummary:'Verified fixture experience',nationalId:'private-fixture-identity'}});
  const payload={make:'Mercedes',model:'C200',year:2020,fuel:'PETROL',clientVehicleId:randomUUID()};const a=(await api('/api/customer/vehicles','POST',payload,owner.token)).body.vehicle;const b=(await api('/api/customer/vehicles','POST',{...payload,model:'E200',clientVehicleId:randomUUID()},owner.token)).body.vehicle;
  let list=(await api('/api/customer/vehicles','GET',undefined,owner.token)).body.vehicles;assert.equal(list.find(v=>v.id===b.id).isActive,true);assert.equal(list.filter(v=>v.isActive).length,1);
  assert.equal((await api('/api/customer/vehicles/'+a.id+'/select','POST',{},other.token)).status,404);assert.equal((await api('/api/customer/vehicles/'+a.id,'PATCH',{...payload,version:0},other.token)).status,404);assert.equal((await api('/api/customer/vehicles/'+a.id,'DELETE',{version:0},other.token)).status,404);
  await Promise.all([api('/api/customer/vehicles/'+a.id+'/select','POST',{},owner.token),api('/api/customer/vehicles/'+b.id+'/select','POST',{},owner.token)]);assert.equal(await prisma.customerVehicle.count({where:{customerId:owner.id,isActive:true,archivedAt:null}}),1);
  await api('/api/customer/vehicles/'+a.id+'/select','POST',{},owner.token);list=(await api('/api/customer/vehicles','GET',undefined,owner.token)).body.vehicles;assert.equal(list.find(v=>v.isActive).id,a.id);
  const profile=await api('/api/customer/mechanics/'+mechanic.id+'?mode=WORKSHOP','GET',undefined,owner.token);assert.equal(profile.status,200);assert.equal(profile.body.mechanic.experienceSummary,'Verified fixture experience');assert.ok(!JSON.stringify(profile.body).includes('private-fixture-identity'));assert.equal((await api('/api/customer/mechanics/'+mechanic.id+'?mode=ONLINE','GET',undefined,owner.token)).status,404);
  const send={mechanicId:mechanic.id,vehicleId:a.id,vehicle:'client text is not authoritative',mode:'WORKSHOP',title:'Engine inspection',description:'Engine vibration at idle.',contactNumber:'0599999999',address:'',clientRequestId:randomUUID()};
  assert.equal((await api('/api/service-requests','POST',send,other.token)).status,404);const sent=await api('/api/service-requests','POST',send,owner.token);assert.equal(sent.status,201);requestIds.push(sent.body.request.id);assert.equal(sent.body.request.vehicle,'Mercedes C200 · 2020');assert.equal(sent.body.request.vehicleId,a.id);
  const edited=await api('/api/customer/vehicles/'+a.id,'PATCH',{...payload,model:'C220',version:0},owner.token);assert.equal(edited.status,200);assert.equal(edited.body.vehicle.version,1);assert.equal((await api('/api/customer/vehicles/'+a.id,'PATCH',{...payload,version:0},owner.token)).status,409);
  assert.equal((await prisma.serviceRequest.findUnique({where:{id:sent.body.request.id}})).vehicle,'Mercedes C200 · 2020');
  assert.equal((await api('/api/customer/vehicles/'+a.id,'DELETE',{version:0},owner.token)).status,409);const removed=await api('/api/customer/vehicles/'+a.id,'DELETE',{version:1},owner.token);assert.equal(removed.status,200);assert.equal(removed.body.vehicles.length,1);assert.equal(removed.body.vehicles[0].isActive,true);assert.ok((await prisma.customerVehicle.findUnique({where:{id:a.id}})).archivedAt);assert.ok(await prisma.serviceRequest.findUnique({where:{id:sent.body.request.id}}));
  assert.equal((await api('/api/customer/vehicles/'+a.id+'/select','POST',{},owner.token)).status,404);assert.equal((await api('/api/service-requests','POST',{...send,clientRequestId:randomUUID()},owner.token)).status,404);
  assert.equal((await api('/api/customer/vehicles','GET',undefined,mechanic.token)).status,403);assert.equal((await api('/api/customer/vehicles','GET',undefined,other.token)).body.vehicles.length,0);
 }finally{await prisma.notification.deleteMany({where:{OR:[{userId:{in:ids}},{relatedUserId:{in:ids}}]}});await prisma.auditLog.deleteMany({where:{actorId:{in:ids}}});await prisma.serviceRequest.deleteMany({where:{id:{in:requestIds}}});await prisma.user.deleteMany({where:{id:{in:ids}}});await new Promise(r=>server.close(r));await prisma.$disconnect();}
});
