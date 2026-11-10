// The injected fetchers in provider tests handle fixtures. Accidental live calls must never leave the test process.
const realFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(/(^|\.)(meshy\.ai|sketchfab\.com|sketchfabcdn\.com)$/.test(url.hostname))throw Error('Live 3D provider access is forbidden in automated tests; inject a mock transport.');
 return realFetch(input,init);
};
