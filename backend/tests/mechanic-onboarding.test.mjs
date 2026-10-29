import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import {randomUUID} from 'node:crypto';
import {unlink} from 'node:fs/promises';
import path from 'node:path';
import {prisma} from '../dist/prisma.js';
import {createMechanicRegistrationRouter} from '../dist/routes/mechanic-registration.routes.js';
import mechanics from '../dist/routes/mechanics.routes.js';
import auth from '../dist/routes/auth.routes.js';

test('mechanic registration without email, private documents, review, resubmission and live approval gating',async()=>{
 const tag='onboarding-'+randomUUID(),email=tag+'@example.invalid',ids=[],profiles=[];
 const app=express();app.use(express.json({limit:'8mb'}));app.use('/api/auth',auth);
 app.use('/api/auth/mechanic',createMechanicRegistrationRouter());
 app.use('/api/mechanics',mechanics);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function api(route,method='GET',body,token){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
 const token=u=>jwt.sign({role:u.role,sessionVersion:0},process.env.JWT_SECRET,{subject:u.id,expiresIn:'10m',algorithm:'HS256'});
 let fileKeys=[];
 try{
  const input={fullName:'Test Mechanic',email,phoneNumber:'0599999999',city:'Ramallah',password:'Test!Pass1234',acceptTerms:true,role:'MECHANIC'};
  assert.equal((await api('/api/auth/mechanic/register','POST',{...input,role:'SUPER_ADMIN'})).status,400);
  let r=await api('/api/auth/mechanic/register','POST',input);assert.equal(r.status,201);assert.equal(r.body.challengeId,undefined);
  let mechanic=await prisma.user.findUnique({where:{email},include:{mechanicProfile:true}});ids.push(mechanic.id);profiles.push(mechanic.mechanicProfile.id);
  assert.equal(mechanic.status,'ACTIVE');assert.equal(mechanic.emailVerifiedAt,null);assert.equal(await prisma.mechanicEmailCheck.count({where:{userId:mechanic.id}}),0);assert.equal(mechanic.mechanicProfile.verificationStatus,'DRAFT');
  assert.notEqual(mechanic.passwordHash,input.password);
  assert.equal((await api('/api/auth/mechanic/register','POST',input)).status,409);
  r=await api('/api/auth/login','POST',{email,password:input.password});assert.equal(r.status,200);const mt=r.body.accessToken;
  assert.equal((await api('/api/auth/me','GET',undefined,mt)).status,200);
  const reviewer=await prisma.user.create({data:{fullName:'Test Reviewer',email:tag+'-review@example.invalid',passwordHash:'unused',role:'ADMIN',status:'ACTIVE',adminPermissions:{create:{permission:'MANAGE_MECHANICS'}}}});
  const wrong=await prisma.user.create({data:{fullName:'Other Department',email:tag+'-parts@example.invalid',passwordHash:'unused',role:'ADMIN',status:'ACTIVE',adminPermissions:{create:{permission:'MANAGE_SPARE_PARTS'}}}});
  const other=await prisma.user.create({data:{fullName:'Other Mechanic',email:tag+'-other@example.invalid',passwordHash:'unused',role:'MECHANIC',status:'ACTIVE'}});
  ids.push(reviewer.id,wrong.id,other.id);const rt=token(reviewer);
  assert.equal((await api('/api/mechanics/admin','GET',undefined,token(wrong))).status,403);
  assert.equal((await api('/api/mechanics/me/service-access','GET',undefined,mt)).status,403);
  assert.equal((await api('/api/mechanics/me/submit','POST',{acceptPrivacy:true},mt)).status,400);
  const professional={city:'Ramallah',phoneNumber:'0599999999',specializations:['PETROL_ENGINES'],yearsOfExperience:5,experienceSummary:'Five years of automotive repair.',offersWorkshop:true,workshopName:'Test Workshop',workshopAddress:'Test address',offersOnSite:true,coverageAreas:['Ramallah'],offersOnline:true};
  assert.equal((await api('/api/mechanics/me','PUT',{...professional,specializations:['BAD']},mt)).status,400);
  assert.equal((await api('/api/mechanics/me','PUT',professional,mt)).status,200);
  assert.equal((await api('/api/mechanics/me/documents','POST',{kind:'IDENTITY',base64:Buffer.from('<html>unsafe</html>').toString('base64'),mimeType:'image/png',fileName:'bad.png'},mt)).status,400);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
  r=await api('/api/mechanics/me/documents','POST',{kind:'IDENTITY',base64:png,mimeType:'image/png',fileName:'identity.png'},mt);assert.equal(r.status,201);const documentId=r.body.profile.documents[0].id;assert.equal(r.body.profile.documents[0].storageKey,undefined);
  assert.equal((await api('/api/mechanics/documents/'+documentId,'GET',undefined,token(other))).status,403);
  assert.equal((await api('/api/mechanics/documents/'+documentId,'GET',undefined,token(wrong))).status,403);
  assert.equal((await api('/api/mechanics/me/submit','POST',{acceptPrivacy:true},mt)).status,400);
  assert.equal((await api('/api/mechanics/me/documents','POST',{kind:'CERTIFICATE',base64:png,mimeType:'image/png',fileName:'certificate.png'},mt)).status,201);
  assert.equal((await api('/api/mechanics/me/submit','POST',{acceptPrivacy:true},mt)).status,400);
  assert.equal((await api('/api/mechanics/me/documents','POST',{kind:'WORKSHOP_PROOF',base64:png,mimeType:'image/png',fileName:'workshop.png'},mt)).status,201);
  assert.equal(await prisma.auditLog.count({where:{actorId:reviewer.id,targetId:profiles[0],action:'MECHANIC_DOCUMENT_VIEWED'}}),0);
  r=await api('/api/mechanics/me/submit','POST',{acceptPrivacy:true},mt);assert.equal(r.status,200);let version=r.body.profile.submissionVersion;assert.equal(r.body.profile.verificationStatus,'PENDING');
  assert.equal((await api('/api/mechanics/me','PUT',professional,mt)).status,409);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'APPROVE',submissionVersion:version},rt)).status,400);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'NEEDS_COMPLETION',notes:'Please provide a clearer identity image.',submissionVersion:version},rt)).status,200);
  assert.equal((await api('/api/mechanics/me','PUT',professional,mt)).status,200);
  r=await api('/api/mechanics/me/submit','POST',{acceptPrivacy:true},mt);assert.equal(r.status,200);version=r.body.profile.submissionVersion;
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/interview','POST',{result:'PASSED',notes:'Explained safe diagnostic procedures.',submissionVersion:version-1},rt)).status,409);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/interview','POST',{result:'PASSED',notes:'Explained safe diagnostic procedures.',submissionVersion:version},rt)).status,200);
  r=await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'APPROVE',submissionVersion:version},rt);assert.equal(r.status,200);assert.equal(r.body.profile.canReceiveServices,true);
  assert.equal((await api('/api/mechanics/me/service-access','GET',undefined,mt)).status,200);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'APPROVE',submissionVersion:version},rt)).status,409);
  assert.equal((await api('/api/mechanics/admin/'+mechanic.id+'/decision','POST',{action:'SUSPEND',notes:'Services suspended pending an account review.',submissionVersion:version},rt)).status,200);
  assert.equal((await api('/api/mechanics/me/service-access','GET',undefined,mt)).status,403);
  assert.equal((await api('/api/mechanics/me','GET',undefined,mt)).status,200);
  r=await api('/api/mechanics/notifications','GET',undefined,mt);assert.ok(r.body.notifications.length>=4);
  assert.ok((await prisma.auditLog.count({where:{targetId:profiles[0]}}))>=8);
  assert.equal(await prisma.auditLog.count({where:{actorId:reviewer.id,targetId:profiles[0],action:'MECHANIC_DOCUMENT_VIEWED'}}),0);
 }finally{
  fileKeys=(await prisma.mechanicDocument.findMany({where:{profileId:{in:profiles}},select:{storageKey:true}})).map(d=>d.storageKey);
  await prisma.notification.deleteMany({where:{OR:[{userId:{in:ids}},{relatedUserId:{in:ids}}]}});
  await prisma.auditLog.deleteMany({where:{OR:[{actorId:{in:ids}},{targetId:{in:[...ids,...profiles]}}]}});
  await prisma.user.deleteMany({where:{id:{in:ids}}});
  const dir=path.resolve('.private/mechanic-documents');for(const k of fileKeys){const f=path.resolve(dir,k);if(f.startsWith(dir+path.sep))await unlink(f).catch(()=>{});}
  await new Promise(r=>server.close(r));await prisma.$disconnect();
 }
});
