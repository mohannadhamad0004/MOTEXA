import {test} from 'node:test';import assert from 'node:assert/strict';
import {selectPreviewCar,canPreviewPart} from '../src/features/accessory3d/eligibility.ts';
import {THREE_D_ERRORS,threeDError,threeDReason} from '../src/features/vehicleCatalog/lifecycleText.ts';
import {accessoryProcessingLabel} from '../src/features/accessory3d/processing.ts';
test('successful Meshy tasks show factual local processing and failure states in both languages',()=>{
 const task={status:'GENERATING',generationStage:'GENERATING',providerState:'SUCCEEDED'};
 assert.equal(accessoryProcessingLabel(task)[0],'Retrieving generated model');
 for(const [stage,label] of [['DOWNLOADING','Retrieving generated model'],['OPTIMIZING','Optimizing generated model'],['VALIDATING','Validating generated model'],['CHECKING_FIT','Checking fit']]){
  const copy=accessoryProcessingLabel({...task,generationStage:stage});assert.equal(copy[0],label);assert.match(copy[1],/[\u0600-\u06ff]/);
 }
 assert.equal(accessoryProcessingLabel({...task,status:'APPROVED_FOR_GENERATION',generationStage:'FAILED',lifecycleState:'FAILED'})[0],'Model processing failed');
 assert.equal(accessoryProcessingLabel({...task,providerState:'IN_PROGRESS'}),null);
 assert.equal(accessoryProcessingLabel({...task,status:'READY_FOR_FINAL_REVIEW',generationStage:'READY'}),null);
});
test('preview follows the ACTIVE car only: never another saved car, no fallback, Garage is never modified',()=>{
 const cars=[{carId:'active-missing-3d',isActive:true,allowed:false},{carId:'compatible',isActive:false,allowed:true}],before=JSON.stringify(cars);
 assert.equal(selectPreviewCar(cars).carId,'active-missing-3d');assert.equal(selectPreviewCar(cars).allowed,false);
 assert.equal(selectPreviewCar(cars.map(c=>({...c,isActive:!c.isActive}))).carId,'compatible');
 assert.equal(selectPreviewCar(cars.map(c=>({...c,isActive:false}))),undefined);
 assert.equal(JSON.stringify(cars),before);
});
test('customer kits require the backend allowed result, published model and saved fit; stale contracts fail closed',()=>{
 const part={part:'MAIN',type:'REAR_BUMPER',fitsIds:['generation'],model:{file:'accessories/acc-fixture.glb',size:{}},autoFit:{fit:{placements:[{}]},adj:null},allowed:true};
 assert.equal(canPreviewPart(part),true);for(const patch of [{allowed:false},{allowed:undefined},{model:null},{autoFit:null}])assert.equal(canPreviewPart({...part,...patch}),false);
});
test('all required lifecycle errors have English and Arabic copy, including backend equivalent names',()=>{
 for(const key of ['NO_VEHICLE_3D','NO_ACCESSORY_3D','NO_COMPATIBLE_GARAGE_CAR','PENDING_3D_REQUEST','DUPLICATE_REQUEST','GENERATION_NOT_APPROVED','GENERATION_ALREADY_RUNNING','GENERATION_FAILED','FIT_FAILED','FIT_REVIEW_REQUIRED','PRIVATE_ASSET','PUBLICATION_BLOCKED','MODEL_REFERENCED','DELETE_BLOCKED','SOURCE_INVALID','PART_MAP_STALE','CATALOG_REVISION_STALE']){assert.equal(THREE_D_ERRORS[key].length,2);assert.match(THREE_D_ERRORS[key][1],/[\u0600-\u06ff]/);}
 assert.equal(threeDError({data:{code:'MODEL_REFERENCED'},message:'raw server detail'},(en,ar)=>ar),THREE_D_ERRORS.MODEL_REFERENCED[1]);assert.equal(threeDReason('STALE_PART_MAP',en=>en),THREE_D_ERRORS.STALE_PART_MAP[0]);
});
