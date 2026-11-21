import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {createPasswordResetRouter} from '../src/routes/password-reset.routes.js';
import {RESET_RESPONSE} from '../src/services/password-reset.service.js';

test('request endpoint validates input, returns a generic response and rate limits without accessing live mail or data',async()=>{
 let allowed=true,room=true;const emails:string[]=[];const jobs:Array<()=>Promise<void>>=[];
 const app=express();app.use(express.json());app.use('/api/auth/password-reset',createPasswordResetRouter({allow:()=>allowed,enqueue:job=>{if(room)jobs.push(job);return room;},request:async email=>{emails.push(email);}}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/password-reset/request-otp`;
 const post=(email:unknown)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
 try{
  for(const email of [null,12,'bad',' a b@example.com ','a'.repeat(255)+'@example.com'])assert.equal((await post(email)).status,400);
  const response=await post('  Sample@Example.Invalid  ');assert.equal(response.status,202);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),RESET_RESPONSE);assert.equal(emails.length,0,'response does not await or depend on mail delivery');await jobs[0]();assert.deepEqual(emails,['sample@example.invalid']);
  assert.deepEqual(await(await post('unknown@example.invalid')).json(),RESET_RESPONSE);
  allowed=false;assert.equal((await post('sample@example.invalid')).status,429);allowed=true;room=false;assert.equal((await post('sample@example.invalid')).status,503);
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
