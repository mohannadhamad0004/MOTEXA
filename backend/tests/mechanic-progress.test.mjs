import test from 'node:test';
import assert from 'node:assert/strict';
import {mechanicProgress} from '../dist/services/mechanic-progress.js';
const base={verificationStatus:'PENDING',submittedAt:new Date(),submissionVersion:2,offersWorkshop:true,interviewResult:null,user:{status:'ACTIVE'},documents:[{id:'id',kind:'IDENTITY',storageKey:'id-v2'},{id:'certificate',kind:'CERTIFICATE',storageKey:'cert-v1'},{id:'workshop',kind:'WORKSHOP_PROOF',storageKey:'work-v1'}]};
const testRecord={submissionVersion:2,attempt:1,submittedAt:null,reviewedAt:null,assessment:null};
test('Progress uses current documents and submission, without exposing tests, storage keys or reviewer notes',()=>{
 const progress=mechanicProgress(base,[{...testRecord,submissionVersion:1,submittedAt:new Date(),reviewedAt:new Date(),assessment:'PASSED'}],[{documentId:'id',storageKey:'id-v1'},{documentId:'certificate',storageKey:'cert-v1'}]);
 assert.equal(progress.stage,'ADMIN_REVIEW');assert.equal(progress.documents.find(d=>d.kind==='IDENTITY').reviewed,false);assert.equal(progress.documents.find(d=>d.kind==='CERTIFICATE').reviewed,true);assert.equal(progress.assessment.assigned,false);assert(!JSON.stringify(progress).includes('storageKey'));assert(!JSON.stringify(progress).includes('correctIndex'));assert.equal(progress.canReceiveServices,false);
});
test('Next action distinguishes test answering, review, interview and decision, including legacy approvals',()=>{
 assert.equal(mechanicProgress(base,[testRecord],[]).stage,'TAKE_TEST');assert.equal(mechanicProgress(base,[{...testRecord,submittedAt:new Date()}],[]).stage,'TEST_REVIEW');const passed={...testRecord,submittedAt:new Date(),reviewedAt:new Date(),assessment:'PASSED'};
 assert.equal(mechanicProgress(base,[passed],[]).stage,'INTERVIEW_REVIEW');assert.equal(mechanicProgress({...base,interviewResult:'PASSED'},[passed],[]).stage,'AWAITING_DECISION');assert.equal(mechanicProgress({...base,interviewResult:'PASSED'},[],[]).stage,'AWAITING_DECISION');assert.equal(mechanicProgress(base,[{...passed,assessment:'FAILED'}],[]).stage,'ASSESSMENT_RECORDED');assert.equal(mechanicProgress(base,[{...passed,attempt:1},{...testRecord,attempt:2}],[]).stage,'TAKE_TEST');
});
test('Completion, rejection and suspension never imply approval; blocked accounts cannot receive services',()=>{
 for(const status of ['NEEDS_COMPLETION','REJECTED','SUSPENDED']){const progress=mechanicProgress({...base,verificationStatus:status},[],[]);assert.equal(progress.stage,status);assert.equal(progress.canReceiveServices,false);}
 const approved=mechanicProgress({...base,verificationStatus:'VERIFIED'},[],[]);assert.equal(approved.stage,'APPROVED');assert.equal(approved.canReceiveServices,true);assert.equal(approved.action,'NONE');assert.equal(mechanicProgress({...base,verificationStatus:'VERIFIED',user:{status:'SUSPENDED'}},[],[]).stage,'ACCOUNT_BLOCKED');assert.equal(mechanicProgress({...base,verificationStatus:'DRAFT',submittedAt:null},[],[]).action,'EDIT');
});
