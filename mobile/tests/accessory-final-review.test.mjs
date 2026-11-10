import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewAction,reviewRoute,REVIEW_LABELS,REVIEW_BLOCKERS} from '../src/features/accessory3d/reviewState.ts';
const target={generationId:'real-generation',model3dKey:'bmw-3-series-e36',name:'BMW E36',nameAr:'بي إم دبليو',has3d:true,semanticPart:'REAR_BUMPER',partMap:'CONFIRMED',fit:{state:'PASSED',current:true,approvedAt:null,reason:null},previewCurrent:false};
const review={model:{generated:true,exists:true,optimized:true,validation:'PASSED',reason:null},targets:[target],publication:{state:'PRIVATE_CANDIDATE',canPublish:false,blockers:[{code:'FIT_REVIEW_REQUIRED',message:'Review fit'}]},canRetryProcessing:false};
test('missing/stale part map opens the exact generation and rear-bumper semantic part; publication stays blocked',()=>{
 for(const partMap of ['MISSING','STALE']){const t={...target,partMap};assert.equal(reviewAction(review,t),'partMap');const q=new URL(reviewRoute('request-id',t,'parts'),'https://motexa.test').searchParams;assert.equal(q.get('model3dKey'),target.model3dKey);assert.equal(q.get('generationId'),target.generationId);assert.equal(q.get('label'),'REAR_BUMPER');assert.equal(q.get('requestId'),'request-id');assert.equal(review.publication.canPublish,false);}
});
test('part map ready with no fit offers automatic fit; running fits offer no duplicate action',()=>{
 assert.equal(reviewAction(review,{...target,fit:{...target.fit,state:'NOT_RUN'}}),'runFit');assert.equal(reviewAction(review,{...target,fit:{...target.fit,state:'RUNNING'}}),null);
});
test('correction and passed results select corrections or review and retain the accessory/car selection',()=>{
 assert.equal(reviewAction(review,{...target,fit:{...target.fit,state:'NEEDS_CORRECTION'}}),'corrections');assert.equal(reviewAction(review,target),'reviewFit');const q=new URL(reviewRoute('request-id',target,'fits'),'https://motexa.test').searchParams;assert.equal(q.get('accessoryId'),'request-id');assert.equal(q.get('generationId'),target.generationId);
});
test('approved fit still needs the current final preview; publication uses only backend readiness',()=>{
 const t={...target,fit:{...target.fit,state:'APPROVED',approvedAt:'2026-11-08'}};assert.equal(reviewAction(review,t),'preview');const ready={...review,publication:{state:'READY_FOR_FINAL_REVIEW',canPublish:true,blockers:[]}};assert.equal(reviewAction(ready,{...t,previewCurrent:true}),'reviewFit');
});
test('published controls replace final publication and failed validation selects same-task processing recovery',()=>{
 assert.equal(reviewAction({...review,publication:{state:'PUBLISHED',canPublish:false,blockers:[]}},target),'published');assert.equal(reviewAction({...review,model:{...review.model,validation:'FAILED'},canRetryProcessing:true},target),'retryProcessing');
});
test('every review state has English and Arabic copy without replacement characters',()=>{
 for(const [en,ar] of [...Object.values(REVIEW_LABELS),...Object.values(REVIEW_BLOCKERS)]){assert.ok(en.length);assert.match(ar,/[\u0600-\u06ff]/);assert.doesNotMatch(ar,/\?{2,}|\ufffd/);}
});
