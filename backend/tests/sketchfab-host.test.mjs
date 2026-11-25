import test from 'node:test';import assert from 'node:assert/strict';import {authorizations,api,metadata} from '../scripts/sketchfab-host.mjs';
const P='0123456789abcdef0123456789abcdef'; // shaped like a personal API token (test-only)
test('host helper: the personal API token as Token, Bearer only for a real OAuth token, one Token retry after a Bearer 401',async()=>{
  assert.throws(()=>authorizations({}),/MISSING_SKETCHFAB_TOKEN/);
  assert.deepEqual(authorizations({SKETCHFAB_API_TOKEN:P}),[{Authorization:'Token '+P}]);
  assert.deepEqual(authorizations({SKETCHFAB_API_TOKEN:P,SKETCHFAB_ACCESS_TOKEN:P}),[{Authorization:'Token '+P}],'the personal token in the OAuth slot is never sent as Bearer');
  assert.deepEqual(authorizations({SKETCHFAB_ACCESS_TOKEN:'oauth-test-only'}),[{Authorization:'Bearer oauth-test-only'}]);
  const tries=[];const body=await api('me',{SKETCHFAB_API_TOKEN:P,SKETCHFAB_ACCESS_TOKEN:'oauth-test-only'},async(_u,o)=>{tries.push(o.headers.Authorization);return o.headers.Authorization.startsWith('Bearer')?{ok:false,status:401}:{ok:true,status:200,json:async()=>({uid:'me'})};});
  assert.deepEqual(body,{uid:'me'});assert.deepEqual(tries,['Bearer oauth-test-only','Token '+P]);
});
test('host helper distinguishes no-response errors from HTTP authorization failures',async()=>{const env={SKETCHFAB_ACCESS_TOKEN:'oauth-test-only'};await assert.rejects(api('me',env,async()=>{throw Object.assign(new Error('do not log arbitrary network text'),{cause:{code:'EACCES'}});}),/NO_HTTP_RESPONSE: EACCES/);for(const status of [401,403])await assert.rejects(api('me',env,async()=>({ok:false,status})),new RegExp('HTTP_'+status));});
test('candidate metadata contains provenance but no API or signed URLs',()=>{const m=metadata({uid:'abc',name:'Car',isDownloadable:true,license:{slug:'by',label:'CC BY'},user:{username:'maker'},download:{url:'signed-secret'},access_token:'secret'});assert.equal(m.creator,'maker');assert.equal(m.generationVerified,false);assert.doesNotMatch(JSON.stringify(m),/secret/);});
