// Retain a genuine login token in memory until its actual server-issued expiry.
const {login,api,save}=require('./common.cjs');
(async()=>{
 const s=await login('admin.parts');
 const claims=JSON.parse(Buffer.from(s.token.split('.')[1],'base64url').toString());
 const start=await api(s,'/admin/parts/vehicle-3d-models');
 const evidence={startedAt:new Date().toISOString(),lifetimeSeconds:claims.exp-claims.iat,beforeStatus:start.status,expiresAt:new Date(claims.exp*1000).toISOString()};
 save('E-03-running',evidence); console.log(JSON.stringify(evidence));
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,claims.exp*1000-Date.now()+1500)));
 const after=await api(s,'/admin/parts/vehicle-3d-models');
 const me=await api(s,'/auth/me');
 save('E-03-expiry',{...evidence,checkedAt:new Date().toISOString(),after,me});
 console.log(JSON.stringify({afterStatus:after.status,meStatus:me.status}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
