/** Zoom credentials and host URLs must never leave the backend. */
export class ZoomError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Config = {accountId:string;clientId:string;clientSecret:string;host:string};
type Meeting = {id:string;joinUrl:string};
export function zoomConfig(env:NodeJS.ProcessEnv=process.env):Config {
  const values=[env.ZOOM_ACCOUNT_ID,env.ZOOM_CLIENT_ID,env.ZOOM_CLIENT_SECRET,env.ZOOM_HOST_USER_ID].map(v=>v?.trim()||'');
  if(values.some(v=>!v))throw new ZoomError(503,'Zoom is not connected yet. Ask the project administrator to configure the Zoom account. / حساب Zoom غير مربوط بعد. يجب إعداد حساب المشروع أولًا.');
  return {accountId:values[0],clientId:values[1],clientSecret:values[2],host:values[3]};
}
export function zoomClient(config:Config,request:typeof fetch=fetch){
  async function call(url:string,init:RequestInit){
    try{return await request(url,{...init,redirect:'error',signal:AbortSignal.timeout(10000)});}
    catch{throw new ZoomError(502,'Could not reach Zoom. Check the host’s Zoom meetings before retrying. / تعذر الاتصال بـ Zoom. تحقّق من اجتماعات الحساب قبل إعادة المحاولة.');}
  }
  async function token(){
    const response=await call('https://zoom.us/oauth/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(config.clientId+':'+config.clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'account_credentials',account_id:config.accountId})});
    if(!response.ok)throw new ZoomError(502,'Zoom authorization failed. Check the server’s Zoom app credentials and activation. / تعذر ربط Zoom. تحقّق من إعدادات التطبيق وتفعيله.');
    const data=await response.json().catch(()=>null);
    if(typeof data?.access_token!=='string'||!data.access_token)throw new ZoomError(502,'Zoom returned an invalid authorization response.');
    return data.access_token as string;
  }
  async function remove(id:string){
    const access=await token();
    const response=await call('https://api.zoom.us/v2/meetings/'+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:'Bearer '+access}});
    if(!response.ok&&response.status!==404)throw new ZoomError(502,'Zoom could not cancel the unused meeting.');
  }
  async function create(start:Date,timeZone:string):Promise<Meeting>{
    const access=await token();
    const response=await call('https://api.zoom.us/v2/users/'+encodeURIComponent(config.host)+'/meetings',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({topic:'MOTEXA · Professional interview',type:2,start_time:start.toISOString(),timezone:timeZone,duration:30,settings:{use_pmi:false,waiting_room:true,join_before_host:false,auto_recording:'none'}})});
    if(!response.ok)throw new ZoomError(502,response.status===429?'Zoom rate limit reached. Try later.':'Zoom could not create the meeting. Check the host account and meeting permissions. / تعذر إنشاء اجتماع Zoom. تحقّق من الحساب وصلاحيات الاجتماعات.');
    const data=await response.json().catch(()=>null);
    const id=typeof data?.id==='number'||typeof data?.id==='string'?String(data.id):'';
    let joinUrl='';
    try{const u=new URL(data?.join_url);if(u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='zoom.us'||u.hostname.endsWith('.zoom.us')||u.hostname==='zoom.com'||u.hostname.endsWith('.zoom.com'))&&u.pathname.startsWith('/j/'))joinUrl=u.href;}catch{}
    if(!id||!joinUrl){if(id)await remove(id).catch(()=>console.error('Zoom cleanup required for meeting',id));throw new ZoomError(502,'Zoom did not return a valid participant link. No invitation was sent.');}
    // Deliberately discard start_url, passwords, token and all other response fields.
    return {id,joinUrl};
  }
  return {create,remove};
}
