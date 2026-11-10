const {login,api,db,save}=require('./common.cjs');
(async()=>{
 const c=await db();
 try {
 const queries={
  drivers:`SELECT d.id,d.approval,d.offline,d."truckId",u.email LIKE '%@motexa.test' AS dev_account,cu.email AS company_dev_email FROM "TowDriver" d JOIN "User" u ON u.id=d."userId" JOIN "TowCompany" co ON co.id=d."companyId" JOIN "User" cu ON cu.id=co."userId" WHERE cu.email LIKE '%@motexa.test'`,
  driverCounts:`SELECT approval,COUNT(*) FROM "TowDriver" GROUP BY approval`,
  workingJobs:`SELECT id,status,"assignedDriverId","towCompanyId" FROM "TowRequest" WHERE status IN ('ACCEPTED','EN_ROUTE','IN_PROGRESS')`,
  accessories:`SELECT id,status,"productId","providerState","hasModel" FROM "ProductAccessory3D"`,
  generations:`SELECT g.id,v.make,v.model,g.code,g."isPublished",g."isActive",g."model3dKey",v."isActive" AS model_active,b."isActive" AS brand_active FROM "VehicleGeneration" g JOIN "Vehicle" v ON v.id=g."vehicleId" LEFT JOIN "VehicleBrand" b ON b.id=v."brandId" WHERE g."model3dKey" IS NOT NULL`,
 };
 const sql={};for(const [name,q] of Object.entries(queries)){try{sql[name]=(await c.query(q)).rows}catch(e){sql[name]={error:e.code}}}save('inventory-sql',sql);console.log(JSON.stringify(sql));
 }finally{await c.end()}
 const sessions={};for(const role of ['admin.parts','admin.tow','shop','tow','customer']){try{sessions[role]=await login(role);console.log('login',role,'OK')}catch(e){console.log(e.message)}}
 const endpoints={
 'admin.parts':['/admin/parts/vehicles','/admin/parts/vehicle-3d-models','/admin/parts/vehicle-3d-imports','/admin/parts/accessory-3d','/admin/parts/part-maps'],
 'admin.tow':['/admin/tow/drivers'],shop:['/parts/me/products'],tow:['/tow/me/drivers'],customer:['/catalog/3d-models']};
 const summary={};
 for(const [role,paths] of Object.entries(endpoints))for(const route of paths){if(!sessions[role])continue;const r=await api(sessions[role],route);const key=role+' '+route;summary[key]={status:r.status,keys:r.body?Object.keys(r.body):[],counts:Object.fromEntries(Object.entries(r.body??{}).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))};
 // Save non-personal 3D responses. Driver and product responses stay out of artifacts.
 if(role==='admin.parts'||route==='/catalog/3d-models')save(route.replaceAll('/','_'),r);
 }save('inventory-api',summary);console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e.message);process.exitCode=1});
