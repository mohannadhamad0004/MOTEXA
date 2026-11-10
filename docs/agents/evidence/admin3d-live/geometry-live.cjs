const {login,api,db,save}=require('./common.cjs');
(async()=>{
const s=await login('admin.parts'),customer=await login('customer'),key='bmw-x5-e53',base='/admin/parts/vehicle-3d-models/'+key,out={key};
let before=(await api(s,base)).body.model;
if(before.partMapStatus==='CONFIRMED')throw Error('Do not invalidate an existing confirmed map for this audit');
const previous=before.viewerConfig.groundOffset;
try{
 const changed=await api(s,base+'/config','PATCH',{revision:before.revision,config:{groundOffset:(previous??0)+0.01}});
 const runtime=await api(customer,'/catalog/3d-models');const model=runtime.body.models.find(x=>x.key===key);
 out.before={groundOffset:previous??null,published:before.published,partMapStatus:before.partMapStatus};out.changed={status:changed.status,groundOffset:changed.body.model?.viewerConfig.groundOffset,published:changed.body.model?.published,partMapStatus:changed.body.model?.partMapStatus};out.customer={status:runtime.status,present:!!model,groundOffset:model?.groundOffset};
}finally{
 const current=(await api(s,base)).body.model;
 const restored=await api(s,base+'/config','PATCH',{revision:current.revision,config:{groundOffset:previous??0}});
 out.restore={status:restored.status,groundOffset:restored.body.model?.viewerConfig.groundOffset,published:restored.body.model?.published};save('A-06-live',out);console.log(JSON.stringify(out));
}
})().catch(e=>{console.error(e.message);process.exitCode=1});
