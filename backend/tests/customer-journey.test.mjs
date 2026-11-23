import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import customerRoutes from '../dist/routes/customer.routes.js';
import requestRoutes from '../dist/routes/mechanic-service-requests.routes.js';
import authRoutes from '../dist/routes/auth.routes.js';
import {prisma} from '../dist/prisma.js';

test('Customer journey saves owned cars, shows only eligible mechanics and creates a real service request',async()=>{
 const ids=[],requests=[],app=express();app.use(express.json());app.use('/api/auth',authRoutes);app.use('/api/customer',customerRoutes);app.use('/api/service-requests',requestRoutes);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 async function api(path,method='GET',body,token){const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json()};}
 async function user(role){const u=await prisma.user.create({data:{role,status:'ACTIVE',fullName:'Isolated customer fixture',email:randomUUID()+'@customer.invalid',passwordHash:'test-only'}});ids.push(u.id);return {id:u.id,token:jwt.sign({sessionVersion:0},process.env.JWT_SECRET,{subject:u.id,algorithm:'HS256',expiresIn:'10m'})};}
 try{
  assert.equal((await api('/api/customer/register','POST',{fullName:'A',email:'bad',password:'123'})).status,400);
  const email=randomUUID()+'@customer.invalid';const register=await api('/api/customer/register','POST',{fullName:'Car Owner Fixture',phoneNumber:'0599999999',email,password:'TestPassword12345',role:'SUPER_ADMIN'});assert.equal(register.status,201);assert.equal(register.body.user.role,'CUSTOMER');ids.push(register.body.user.id);assert.equal(register.body.accessToken,undefined);const signedIn=await api('/api/auth/login','POST',{email,password:'TestPassword12345'});assert.equal(signedIn.status,200);const token=signedIn.body.accessToken;
  const session=await api('/api/auth/me','GET',undefined,token);assert.equal(session.status,200);assert.equal(session.body.user.role,'CUSTOMER');assert.equal(session.body.user.id,register.body.user.id);assert.ok(!JSON.stringify(session.body).includes('passwordHash'));
  const account=await api('/api/customer/account','GET',undefined,token);assert.equal(account.body.account.phoneNumber,'0599999999');assert.ok(!JSON.stringify(account.body).includes('passwordHash'));
  assert.equal(jwt.verify(token,process.env.JWT_SECRET).sub,register.body.user.id);assert.ok(!(JSON.stringify(register.body).includes('passwordHash')));
  assert.equal((await api('/api/customer/register','POST',{fullName:'Duplicate',phoneNumber:'0599999999',email,password:'TestPassword12345'})).status,409);
  const other=await user('CUSTOMER'),mechanic=await user('MECHANIC'),pending=await user('MECHANIC'),suspended=await user('MECHANIC');
  await prisma.mechanicProfile.create({data:{userId:mechanic.id,specializations:['PETROL_ENGINES'],city:'CustomerFixtureCity',workshopName:'Fixture Garage',workshopAddress:'Fixture street',nationalId:'private-document',offersWorkshop:true,offersOnSite:true,offersOnline:false,verificationStatus:'VERIFIED'}});
  await prisma.mechanicProfile.create({data:{userId:pending.id,specializations:[],city:'CustomerFixtureCity',offersWorkshop:true,verificationStatus:'PENDING'}});
  await prisma.mechanicProfile.create({data:{userId:suspended.id,specializations:[],city:'CustomerFixtureCity',offersWorkshop:true,verificationStatus:'VERIFIED'}});await prisma.user.update({where:{id:suspended.id},data:{status:'SUSPENDED'}});
  assert.equal((await api('/api/customer/vehicles')).status,401);assert.equal((await api('/api/customer/vehicles','GET',undefined,mechanic.token)).status,403);
  assert.equal((await api('/api/customer/account','PATCH',{fullName:'Edited Fixture',phoneNumber:'0598888888',role:'ADMIN'},token)).status,400);
  assert.equal((await api('/api/customer/account','PATCH',{fullName:'Edited Fixture',phoneNumber:'x'},token)).status,400);
  assert.equal((await api('/api/customer/account','PATCH',{fullName:'Edited Fixture',phoneNumber:'0598888888'},mechanic.token)).status,403);
  const edit=await api('/api/customer/account','PATCH',{fullName:'Edited Fixture',phoneNumber:'0598888888'},token);assert.equal(edit.status,200);assert.equal(edit.body.account.fullName,'Edited Fixture');assert.equal(edit.body.account.email,email);assert.equal((await prisma.user.findUnique({where:{id:other.id}})).fullName,'Isolated customer fixture');assert.equal((await api('/api/customer/account','GET',undefined,token)).body.account.phoneNumber,'0598888888');
  const car={make:'Toyota',model:'Corolla',year:2018,fuel:'PETROL',clientVehicleId:randomUUID()};assert.equal((await api('/api/customer/vehicles','POST',{...car,year:1000},token)).status,400);
  const saved=await Promise.all([api('/api/customer/vehicles','POST',car,token),api('/api/customer/vehicles','POST',car,token)]);assert.deepEqual(saved.map(v=>v.status),[201,201]);assert.equal(saved[0].body.vehicle.id,saved[1].body.vehicle.id);
  assert.equal((await api('/api/customer/vehicles','GET',undefined,other.token)).body.vehicles.length,0);assert.equal((await api('/api/customer/vehicles','GET',undefined,token)).body.vehicles.length,1);
  assert.equal((await api('/api/customer/vehicles','POST',{...car,model:'Other'},token)).status,409);
  const directory=await api('/api/customer/mechanics?city=CustomerFixtureCity&mode=WORKSHOP','GET',undefined,token);assert.equal(directory.status,200);assert.deepEqual(directory.body.mechanics.map(v=>v.userId),[mechanic.id]);assert.ok(!JSON.stringify(directory.body).includes('private-document'));assert.ok(!JSON.stringify(directory.body).includes('passwordHash'));
  assert.equal((await api('/api/customer/mechanics?city=CustomerFixtureCity&mode=ONLINE','GET',undefined,token)).body.mechanics.length,0);assert.equal((await api('/api/customer/mechanics?mode=INVALID','GET',undefined,token)).status,400);
  const body={mechanicId:mechanic.id,mode:'WORKSHOP',title:'Engine inspection',description:'Engine vibrates while idle.',vehicle:'Toyota Corolla 2018',contactNumber:'0599999999',address:'',clientRequestId:randomUUID()};const sent=await api('/api/service-requests','POST',body,token);assert.equal(sent.status,201);requests.push(sent.body.request.id);assert.equal(sent.body.request.status,'NEW');assert.equal((await api('/api/service-requests','POST',body,token)).body.request.id,sent.body.request.id);
  assert.ok((await api('/api/service-requests/mechanic','GET',undefined,mechanic.token)).body.requests.some(r=>r.id===sent.body.request.id));assert.equal((await api('/api/service-requests/customer','GET',undefined,other.token)).body.requests.length,0);
  for(const [action,version,status] of [['ACCEPT',0,'ACCEPTED'],['START',1,'IN_PROGRESS'],['COMPLETE',2,'COMPLETED']]){const changed=await api('/api/service-requests/'+sent.body.request.id+'/action','POST',{action,version},mechanic.token);assert.equal(changed.status,200);const mine=await api('/api/service-requests/customer','GET',undefined,token);assert.equal(mine.body.requests.find(r=>r.id===sent.body.request.id).status,status);}
  const second=await api('/api/service-requests','POST',{...body,clientRequestId:randomUUID()},token);assert.equal(second.status,201);requests.push(second.body.request.id);
  assert.equal((await api('/api/service-requests/'+second.body.request.id+'/cancel','POST',{version:0},token)).body.request.status,'CANCELLED');
 }finally{
  await prisma.auditLog.deleteMany({where:{OR:[{actorId:{in:ids}},{targetId:{in:requests}}]}});await prisma.notification.deleteMany({where:{OR:[{userId:{in:ids}},{relatedUserId:{in:ids}}]}});await prisma.serviceRequest.deleteMany({where:{id:{in:requests}}});await prisma.user.deleteMany({where:{id:{in:ids}}});await new Promise(r=>server.close(r));await prisma.$disconnect();
 }
});
