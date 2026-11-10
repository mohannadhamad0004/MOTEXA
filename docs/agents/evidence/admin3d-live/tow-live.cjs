const {login,api,db,save}=require('./common.cjs');
(async()=>{
 const c=await db(),s=await login('tow'),out={};
 try{
 const owned=(await api(s,'/tow/me/drivers')).body.drivers;
 const ids=owned.map(x=>x.id);
 const rows=(await c.query('SELECT d.id,d."truckId",d.offline,EXISTS(SELECT 1 FROM "TowRequest" r WHERE r."driverId"=d.id AND r.status IN (\'ACCEPTED\',\'EN_ROUTE\',\'IN_PROGRESS\')) AS working FROM "TowDriver" d WHERE d.id=ANY($1::text[])',[ids])).rows;
 const busy=rows.find(x=>x.working);if(busy)out.E01={driverId:busy.id,unchangedTruckId:busy.truckId,result:await api(s,'/tow/me/drivers/'+busy.id,'PATCH',{truckId:busy.truckId})};
 const free=rows.find(x=>!x.working);
 if(free){
 const before=(await c.query('SELECT count(*)::int AS count FROM "AuditLog" WHERE "targetId"=$1',[free.id])).rows[0].count;
 try{
 const changed=await api(s,'/tow/me/drivers/'+free.id,'PATCH',{offline:!free.offline});
 const persisted=(await c.query('SELECT offline FROM "TowDriver" WHERE id=$1',[free.id])).rows[0];
 const after=(await c.query('SELECT count(*)::int AS count FROM "AuditLog" WHERE "targetId"=$1',[free.id])).rows[0].count;
 out.E02={driverId:free.id,beforeOffline:free.offline,changeStatus:changed.status,persistedOffline:persisted.offline,auditsBefore:before,auditsAfter:after};
 }finally{
 const restored=await api(s,'/tow/me/drivers/'+free.id,'PATCH',{offline:free.offline});
 out.E02={...out.E02,restoreStatus:restored.status,restoredOffline:(await c.query('SELECT offline FROM "TowDriver" WHERE id=$1',[free.id])).rows[0].offline};
 }
 }save('E-01-E-02',out);console.log(JSON.stringify(out));
 }finally{await c.end()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
