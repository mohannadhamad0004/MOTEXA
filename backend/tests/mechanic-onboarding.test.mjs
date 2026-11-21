import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import {randomUUID} from 'node:crypto';
import {unlink} from 'node:fs/promises';
import path from 'node:path';
import {prisma} from '../src/prisma.js';
import argon2 from 'argon2';
import apply from '../src/routes/apply.routes.js';
import mechanics from '../src/routes/mechanics.routes.js';
import auth from '../src/routes/auth.routes.js';
import catalogMechanics from '../src/routes/catalog-mechanics.routes.js';
import mechanicRequests from '../src/routes/mechanic-requests.routes.js';

test('mechanic application from a customer account, private documents, review, resubmission and live approval gating',async()=>{
 const tag='onboarding-'+randomUUID(),email=tag+'@example.invalid',ids=[],profiles=[];
 const app=express();app.use(express.json({limit:'8mb'}));app.use('/api/auth',auth);
 app.use('/api',apply); // Work with MOTEXA: the only way to become a mechanic (the old /auth/mechanic/register is gone)
 app.use('/api/mechanics',mechanics);app.use('/api/catalog',catalogMechanics);app.use('/api',mechanicRequests);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function api(route,method='GET',body,token){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
 const token=u=>jwt.sign({role:u.role,sessionVersion:0},process.env.JWT_SECRET,{subject:u.id,expiresIn:'10m',algorithm:'HS256'});
 let fileKeys=[];
 try{
  // a confirmed customer (signup + email code are covered by customer-signup.test.mjs) applies through Work with MOTEXA
  const input={fullName:'Test Mechanic',email,password:'Test!Pass1234'};
  let mechanic=await prisma.user.create({data:{fullName:input.fullName,email,passwordHash:await argon2.hash(input.password),role:'CUSTOMER',status:'ACTIVE',emailVerifiedAt:new Date()}});ids.push(mechanic.id);
  let r=await api('/api/auth/login','POST',{email,password:input.password});assert.equal(r.status,200);let mt=r.body.accessToken;
  assert.equal((await api('/api/mechanics/me','GET',undefined,mt)).status,404,'no application yet');
  r=await api('/api/apply/mechanic','POST',{acknowledgeProviderAccount:true,acceptTerms:true,role:'SUPER_ADMIN'},mt);assert.equal(r.status,201);
  mechanic=await prisma.user.findUnique({where:{email},include:{mechanicProfile:true}});profiles.push(mechanic.mechanicProfile.id);
  assert.equal(mechanic.role,'CUSTOMER');assert.equal(mechanic.mechanicProfile.verificationStatus,'DRAFT');
  assert.equal((await api('/api/auth/me','GET',undefined,mt)).status,200);
  const reviewer=await prisma.user.create({data:{fullName:'Test Reviewer',email:tag+'-review@example.invalid',passwordHash:'unused',role:'ADMIN',status:'ACTIVE',adminPermissions:{create:{permission:'MANAGE_MECHANICS'}}}});
  const wrong=await prisma.user.create({data:{fullName:'Other Department',email:tag+'-parts@example.invalid',passwordHash:'unused',role:'ADMIN',status:'ACTIVE',adminPermissions:{create:{permission:'MANAGE_SPARE_PARTS'}}}});
  const other=await prisma.user.create({data:{fullName:'Other Mechanic',email:tag+'-other@example.invalid',passwordHash:'unused',role:'MECHANIC',status:'ACTIVE'}});
  const customer=await prisma.user.create({data:{fullName:'Test Customer',email:tag+'-customer@example.invalid',passwordHash:'unused',role:'CUSTOMER',status:'ACTIVE'}});
  ids.push(reviewer.id,wrong.id,other.id,customer.id);const rt=token(reviewer),ct=token(customer);
  // a mechanic account without a profile gets a draft application instead of "Mechanic profile not found"
  r=await api('/api/mechanics/me','GET',undefined,token(other));assert.equal(r.status,200);assert.equal(r.body.profile.verificationStatus,'DRAFT');
  r=await api('/api/mechanics/admin/'+customer.id,'GET',undefined,rt);assert.equal(r.status,404);assert.equal(r.body.errorCode,'MECHANIC_PROFILE_NOT_FOUND');
  assert.equal((await api('/api/mechanics/admin','GET',undefined,token(wrong))).status,403);
  assert.equal((await api('/api/mechanics/me/service-access','GET',undefined,mt)).status,403);
  assert.equal((await api('/api/mechanics/me/submit','POST',{acceptPrivacy:true},mt)).status,400);
  const professional={city:'Ramallah',phoneNumber:'0599999999',specializations:['Engine','Brakes'],yearsOfExperience:5,experienceSummary:'Five years of automotive repair.',offersWorkshop:true,workshopName:'Test Workshop',workshopAddress:'Test address',offersOnSite:true,coverageAreas:['Ramallah'],offersOnline:true};
  assert.equal((await api('/api/mechanics/me','PUT',{...professional,specializations:['BAD']},mt)).status,400);
  assert.equal((await api('/api/mechanics/me','PUT',{...professional,city:'Atlantis'},mt)).body.errorCode,'CITY_NOT_IN_LIST');
  assert.equal((await api('/api/mechanics/me','PUT',{...professional,city:'ramallah'},mt)).body.profile.city,'Ramallah');
  assert.equal((await api('/api/mechanics/me','PUT',professional,mt)).status,200);
  // not public before approval
  assert.equal((await api('/api/catalog/mechanics/'+mechanic.id,'GET',undefined,ct)).status,404);
  assert.equal((await api('/api/mechanics/me/documents','POST',{kind:'IDENTITY',base64:Buffer.from('<html>unsafe</html>').toString('base64'),mimeType:'image/png',fileName:'bad.png'},mt)).status,400);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
  r=await api('/api/mechanics/me/documents','POST',{kind:'IDENTITY',base64:png,mimeType:'image/png',fileName:'identity.png'},mt);assert.equal(r.status,201);const documentId=r.body.profile.documents[0].id;assert.equal(r.body.profile.documents[0].storageKey,undefined);
  assert.equal((await api('/api/mechanics/documents/'+documentId,'GET',undefined,token(other))).status,403);
  assert.equal((await api('/api/mechanics/documents/'+documentId,'GET',undefined,token(wrong))).status,403);
  assert.equal((await api('/api/mechanics/documents/'+documentId,'GET',undefined,rt)).status,200);
  r=await api('/api/mechanics/me/submit','POST',{acceptPrivacy:true},mt);assert.equal(r.status,200);let version=r.body.profile.submissionVersion;assert.equal(r.body.profile.verificationStatus,'PENDING');
  assert.equal((await api('/api/mechanics/me','PUT',professional,mt)).status,409);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'APPROVE',submissionVersion:version},rt)).status,400);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'NEEDS_COMPLETION',notes:'Please provide a clearer identity image.',submissionVersion:version},rt)).status,200);
  assert.equal((await api('/api/mechanics/me','PUT',professional,mt)).status,200);
  r=await api('/api/mechanics/me/submit','POST',{acceptPrivacy:true},mt);assert.equal(r.status,200);version=r.body.profile.submissionVersion;
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/interview','POST',{result:'PASSED',notes:'Explained safe diagnostic procedures.',submissionVersion:version-1},rt)).status,409);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/interview','POST',{result:'PASSED',notes:'Explained safe diagnostic procedures.',submissionVersion:version},rt)).status,200);
  r=await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'APPROVE',submissionVersion:version},rt);assert.equal(r.status,200);assert.equal(r.body.profile.canReceiveServices,true);
  // the approval made the customer a MECHANIC and ended the customer session: sign in again
  assert.equal((await api('/api/auth/me','GET',undefined,mt)).status,401);
  r=await api('/api/auth/login','POST',{email,password:input.password});assert.equal(r.body.user.role,'MECHANIC');mt=r.body.accessToken;
  assert.equal((await api('/api/mechanics/me/service-access','GET',undefined,mt)).status,200);
  // approved = public with every listed skill: the customer finds them, sends a request, the mechanic accepts, starts, completes
  r=await api('/api/catalog/mechanics?skill=Brakes&city=Ramallah','GET',undefined,ct);assert.ok(r.body.mechanics.some(x=>x.id===mechanic.id),'listed in the catalog');
  r=await api('/api/catalog/mechanics/'+mechanic.id,'GET',undefined,ct);assert.equal(r.status,200);assert.deepEqual(r.body.mechanic.skills,['Engine','Brakes']);assert.equal(r.body.mechanic.workshopName,'Test Workshop');
  assert.doesNotMatch(JSON.stringify(r.body),/0599999999|example\.invalid/,'no phone or email for customers');
  assert.equal((await api('/api/requests/mechanic','POST',{mechanicId:mechanic.id,skill:'Bodywork',carMake:'Kia',carModel:'Rio',problemDescription:'Engine stalls at idle.',locationText:'Ramallah centre'},ct)).status,400);
  r=await api('/api/requests/mechanic','POST',{mechanicId:mechanic.id,skill:'Engine',carMake:'Kia',carModel:'Rio',problemDescription:'Engine stalls at idle.',locationText:'Ramallah centre'},ct);assert.equal(r.status,201);const job=r.body.request.id;
  assert.ok((await api('/api/mechanic/requests','GET',undefined,mt)).body.requests.some(x=>x.id===job),'in the mechanic inbox');
  for(const step of ['accept','start','complete']){r=await api('/api/mechanic/requests/'+job+'/'+step,'POST',{},mt);assert.equal(r.status,200,step);}
  assert.equal(r.body.request.status,'COMPLETED');
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'APPROVE',submissionVersion:version},rt)).status,409);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'SUSPEND',notes:'Services suspended pending an account review.',submissionVersion:version},rt)).status,200);
  assert.equal((await api('/api/mechanics/me/service-access','GET',undefined,mt)).status,403);
  r=await api('/api/catalog/mechanics/'+mechanic.id,'GET',undefined,ct);assert.equal(r.status,404);assert.equal(r.body.errorCode,'MECHANIC_NOT_FOUND'); // suspended = hidden
  assert.equal((await api('/api/requests/mechanic','POST',{mechanicId:mechanic.id,carMake:'Kia',carModel:'Rio',problemDescription:'Engine stalls at idle.',locationText:'Ramallah centre'},ct)).status,404);
  assert.equal((await api('/api/mechanics/me','GET',undefined,mt)).status,200);
  r=await api('/api/mechanics/notifications','GET',undefined,mt);assert.ok(r.body.notifications.length>=4);
  assert.ok((await prisma.auditLog.count({where:{targetId:profiles[0]}}))>=8);
 }finally{
  fileKeys=(await prisma.mechanicDocument.findMany({where:{profileId:{in:profiles}},select:{storageKey:true}})).map(d=>d.storageKey);
  await prisma.auditLog.deleteMany({where:{OR:[{actorId:{in:ids}},{targetId:{in:[...ids,...profiles]}}]}});
  await prisma.user.deleteMany({where:{id:{in:ids}}});
  const dir=path.resolve('.private/mechanic-documents');for(const k of fileKeys){const f=path.resolve(dir,k);if(f.startsWith(dir+path.sep))await unlink(f).catch(()=>{});}
  await new Promise(r=>server.close(r));await prisma.$disconnect();
 }
});
