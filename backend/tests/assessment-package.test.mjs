import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import {prisma} from '../dist/prisma.js';
import workflow from '../dist/routes/mechanic-workflow.routes.js';
import mechanics from '../dist/routes/mechanics.routes.js';

test('One assessment package assigns approved specialty questions and appointment atomically without bypassing review',async()=>{
 const users=[],qids=[],pids=[];const app=express();app.use(express.json());app.use('/api/mechanic-workflow',workflow);app.use('/api/mechanics',mechanics);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 async function user(role,permission){const u=await prisma.user.create({data:{fullName:'Package fixture '+role,email:randomUUID()+'@package.invalid',passwordHash:'fixture',role,status:'ACTIVE'}});users.push(u.id);if(permission)await prisma.adminPermission.create({data:{adminId:u.id,permission}});return {...u,token:jwt.sign({sessionVersion:0},process.env.JWT_SECRET,{subject:u.id,algorithm:'HS256',expiresIn:'10m'})};}
 async function api(path,method='GET',body,token){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
 try{
  const admin=await user('ADMIN','MANAGE_MECHANICS'),wrong=await user('ADMIN','MANAGE_PARTS'),owner=await user('MECHANIC'),other=await user('MECHANIC');
  const p=await prisma.mechanicProfile.create({data:{userId:owner.id,specializations:['PETROL_ENGINES'],verificationStatus:'PENDING',submittedAt:new Date(),submissionVersion:1,offersWorkshop:true}});pids.push(p.id);
  for(const [specialization,active,reviewStatus] of [['PETROL_ENGINES',true,'APPROVED'],['SAFETY',true,'APPROVED'],['DIESEL_ENGINES',true,'APPROVED'],['PETROL_ENGINES',false,'DRAFT']]){
   const q=await prisma.mechanicQuestion.create({data:{specialization,active,reviewStatus,prompt:'Package fixture question '+randomUUID(),options:['One','Two','Three','Four'],correctIndex:0,createdById:admin.id,reviewerName:'Fixture reviewer',reviewedAt:new Date()}});qids.push(q.id);
  }
  const root='/api/mechanic-workflow/applications/'+owner.id;
  assert.equal((await api(root+'/question-suggestions','GET',undefined,owner.token)).status,403);
  assert.equal((await api(root+'/question-suggestions','GET',undefined,wrong.token)).status,403);
  const suggested=await api(root+'/question-suggestions','GET',undefined,admin.token);assert.equal(suggested.status,200);assert.equal(suggested.body.questions.length,2);assert.equal(suggested.body.submissionVersion,1);
  for(const q of suggested.body.questions){assert.ok(['PETROL_ENGINES','SAFETY'].includes(q.specialization));assert.equal('correctIndex' in q,false);const saved=await prisma.mechanicQuestion.findUnique({where:{id:q.id}});assert.equal(saved.active,true);assert.equal(saved.reviewStatus,'APPROVED');}
  const payload={questionIds:qids.slice(0,2),questionRevisions:Object.fromEntries(qids.slice(0,2).map(id=>[id,1])),submissionVersion:1,expectedTestId:null,expectedScheduleId:null,scheduledAt:new Date(Date.now()+3600000).toISOString(),timeZone:'Asia/Jerusalem',method:'IN_PERSON',location:'Nablus test office',simulation:true,createZoom:false};
  const url=root+'/assessment-package';
  assert.equal((await api(url,'POST',payload,owner.token)).status,403);assert.equal((await api(url,'POST',payload,wrong.token)).status,403);
  assert.equal((await api(url,'POST',{...payload,submissionVersion:0},admin.token)).status,409);
  assert.equal((await api(url,'POST',{...payload,timeZone:'Invalid/Zone'},admin.token)).status,400);
  assert.equal((await api(url,'POST',{...payload,scheduledAt:new Date(Date.now()-60000).toISOString()},admin.token)).status,400);
  assert.equal((await api(url,'POST',{...payload,questionIds:[qids[0],qids[2]]},admin.token)).status,400);
  assert.equal((await api(url,'POST',{...payload,questionRevisions:{[qids[0]]:99,[qids[1]]:1}},admin.token)).status,409);
  const secret=process.env.ZOOM_CLIENT_SECRET;delete process.env.ZOOM_CLIENT_SECRET;
  try{assert.equal((await api(url,'POST',{...payload,method:'ONLINE',location:'',createZoom:true},admin.token)).status,503);}finally{if(secret!==undefined)process.env.ZOOM_CLIENT_SECRET=secret;}
  assert.equal(await prisma.mechanicTest.count({where:{profileId:p.id}}),0);assert.equal((await prisma.mechanicProfile.findUnique({where:{id:p.id}})).interviewScheduleId,null);assert.equal(await prisma.notification.count({where:{userId:owner.id}}),0);
  const sent=await api(url,'POST',payload,admin.token);assert.equal(sent.status,201);assert.equal(sent.body.test.items.length,2);assert.ok(sent.body.scheduleId);
  const saved=await prisma.mechanicProfile.findUnique({where:{id:p.id}});assert.equal(saved.interviewScheduleId,sent.body.scheduleId);assert.equal(saved.interviewLocation,payload.location);assert.equal(saved.interviewConfirmedAt,null);assert.equal(saved.interviewResult,null);assert.equal(saved.verificationStatus,'PENDING');
  assert.equal(await prisma.notification.count({where:{userId:owner.id}}),1);assert.equal((await prisma.notification.findFirst({where:{userId:owner.id}})).kind,'ASSESSMENT_PACKAGE_ASSIGNED');
  assert.equal((await api(url,'POST',payload,admin.token)).status,409);assert.equal(await prisma.mechanicTest.count({where:{profileId:p.id}}),1);
  const mechanicTests=await api(root+'/tests','GET',undefined,owner.token);assert.equal(mechanicTests.status,200);assert.ok(mechanicTests.body.tests[0].items.every(item=>!('correctIndex' in item)));assert.equal((await api(root+'/tests','GET',undefined,other.token)).status,403);
  const confirm='/api/mechanics/me/interview/confirm';assert.equal((await api(confirm,'POST',{scheduleId:sent.body.scheduleId,submissionVersion:1},owner.token)).status,200);
  const submitted=await api('/api/mechanic-workflow/tests/'+sent.body.test.id+'/submit','POST',{answers:sent.body.test.items.map(item=>({itemId:item.id,answerIndex:0}))},owner.token);assert.equal(submitted.status,200);
  assert.equal((await prisma.mechanicProfile.findUnique({where:{id:p.id}})).interviewResult,null,'Answers and appointment confirmation do not record an interview outcome');
  assert.equal((await api('/api/mechanics/admin/'+owner.id+'/decision','POST',{action:'APPROVE',notes:'Fixture final review',submissionVersion:1},admin.token)).status,400);
  const next=await api(url,'POST',{...payload,expectedTestId:sent.body.test.id,expectedScheduleId:sent.body.scheduleId},admin.token);assert.equal(next.status,201);assert.equal(next.body.test.attempt,2);assert.notEqual(next.body.scheduleId,sent.body.scheduleId);
  assert.equal((await api(confirm,'POST',{scheduleId:sent.body.scheduleId,submissionVersion:1},owner.token)).status,409);assert.equal((await prisma.mechanicProfile.findUnique({where:{id:p.id}})).interviewConfirmedAt,null);
 }finally{
  await prisma.notification.deleteMany({where:{OR:[{userId:{in:users}},{relatedUserId:{in:users}}]}});
  await prisma.auditLog.deleteMany({where:{OR:[{actorId:{in:users}},{targetId:{in:pids}}]}});
  await prisma.mechanicQuestion.deleteMany({where:{id:{in:qids}}});await prisma.user.deleteMany({where:{id:{in:users}}});
  await new Promise(r=>server.close(r));await prisma.$disconnect();
 }
});
