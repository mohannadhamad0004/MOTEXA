/** Parse local wall-clock inputs explicitly; never silently accept overflow dates. */
export function interviewInstant(date:string,time:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw Error('DATE_FORMAT');
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);
 const value=new Date(y,m-1,d,h,min,0,0);
 if(y<2000||value.getFullYear()!==y||value.getMonth()!==m-1||value.getDate()!==d||value.getHours()!==h||value.getMinutes()!==min)throw Error('INVALID_DATE');
 return value.toISOString();
}
export function interviewWhen(iso:string,ar:boolean,timeZone?:string|null){
 try{return new Intl.DateTimeFormat(ar?'ar':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:timeZone||undefined}).format(new Date(iso));}catch{return iso;}
}

/** Only an HTTPS participant URL may be opened; no executable or app-private URI. */
export function interviewJoinUrl(value?:string|null){
 try{const u=new URL(value?.trim()||'');return u.protocol==='https:'&&u.hostname&&!u.username&&!u.password?u.toString():null;}catch{return null;}
}
