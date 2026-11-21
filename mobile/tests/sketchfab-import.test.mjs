import {test} from 'node:test';import assert from 'node:assert/strict';
import {IMPORT_ERROR_LABELS,IMPORT_LABELS,runningImport,validYears,importError} from '../src/features/vehicleCatalog/importState.ts';
test('all required failures and stages have English/Arabic copy; progress stages are distinct from terminal states',()=>{
 for(const code of ['BAD_LINK','SKETCHFAB_NOT_FOUND','SKETCHFAB_API_FAILED','NOT_DOWNLOADABLE','LICENSE_NOT_ALLOWED','DUPLICATE_IMPORT','DOWNLOAD_FAILED','DOWNLOAD_TOO_LARGE','ARCHIVE_INVALID','CONVERSION_FAILED','OPTIMIZATION_FAILED','FINAL_ASSET_TOO_LARGE','VALIDATION_REJECTED','PUBLICATION_CONFLICT']){assert.equal(IMPORT_ERROR_LABELS[code].length,2);assert.match(IMPORT_ERROR_LABELS[code][1],/[\u0600-\u06ff]/);}
 for(const state of ['QUEUED','DOWNLOADING','CONVERTING','OPTIMIZING','VALIDATING','GENERATING_PART_MAP']){assert.equal(runningImport(state),true);assert.ok(IMPORT_LABELS[state]);}
 for(const state of ['READY','FAILED','PUBLISHED','DISCARDED'])assert.equal(runningImport(state),false);
});
test('error rendering ignores arbitrary backend messages and year validation matches the managed catalog',()=>{
 const t=(en,ar)=>ar;assert.match(importError({data:{code:'BAD_LINK'},message:'private path'},t),/Sketchfab/);assert.doesNotMatch(importError(new Error('secret filesystem path'),t),/secret/);
 assert.equal(validYears(1990,2000),true);for(const years of [[2001,2000],[1800,2000],[1990,9999],[1990.5,2000]])assert.equal(validYears(...years),false);
});
test('real Sketchfab failures keep provider, auth and network causes distinct in both languages',()=>{
 for(const code of ['INVALID_SKETCHFAB_URL','SKETCHFAB_TOKEN_MISSING','SKETCHFAB_UNAUTHORIZED','SKETCHFAB_NOT_FOUND','SKETCHFAB_RATE_LIMITED','SKETCHFAB_UNAVAILABLE','MODEL_NOT_DOWNLOADABLE','LICENSE_NOT_ALLOWED','DUPLICATE_MODEL','FORBIDDEN','NETWORK_ERROR']){
  assert.match(IMPORT_ERROR_LABELS[code][1],/[\u0600-\u06ff]/);assert.equal(importError({data:{code}},en=>en),IMPORT_ERROR_LABELS[code][0]);
 }
 assert.equal(importError({status:403},en=>en),IMPORT_ERROR_LABELS.FORBIDDEN[0]);
 assert.equal(importError(new TypeError('Network request failed'),en=>en),IMPORT_ERROR_LABELS.NETWORK_ERROR[0]);
});
