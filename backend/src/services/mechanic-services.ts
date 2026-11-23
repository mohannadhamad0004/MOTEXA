export const mechanicServiceModes=['WORKSHOP','ON_SITE','ONLINE'] as const;
export type MechanicServiceMode=typeof mechanicServiceModes[number];
export function serviceModeFilter(value:unknown):{offersWorkshop:true}|{offersOnSite:true}|{offersOnline:true}|Record<string,never>|null {
 if(value===undefined||value==='ALL')return {};
 if(value==='WORKSHOP')return{offersWorkshop:true};
 if(value==='ON_SITE')return{offersOnSite:true};
 if(value==='ONLINE')return{offersOnline:true};
 return null;
}
type ServiceConfig={offersWorkshop:boolean;offersOnSite:boolean;offersOnline:boolean;workshopName:string;workshopAddress:string;coverageAreas:string[]};
/** Drafts may be incomplete. Submission retains the stricter existing completeness gate. */
export function parseServiceConfig(body:Record<string,unknown>):{ok:true;value:ServiceConfig}|{ok:false;message:string}{
 for(const key of ['offersWorkshop','offersOnSite','offersOnline'])if(body[key]!==undefined&&typeof body[key]!=='boolean')return{ok:false,message:'Service choices must be booleans.'};
 for(const [key,max]of [['workshopName',120],['workshopAddress',250]] as const)if(body[key]!==undefined&&body[key]!==null&&(typeof body[key]!=='string'||(body[key] as string).trim().length>max))return{ok:false,message:'Invalid workshop details.'};
 const areas=body.coverageAreas??[];
 if(!Array.isArray(areas)||areas.length>30||areas.some(area=>typeof area!=='string'||area.trim().length>80))return{ok:false,message:'Coverage must contain up to 30 city names, each at most 80 characters.'};
 return{ok:true,value:{offersWorkshop:body.offersWorkshop===true,offersOnSite:body.offersOnSite===true,offersOnline:body.offersOnline===true,workshopName:typeof body.workshopName==='string'?body.workshopName.trim():'',workshopAddress:typeof body.workshopAddress==='string'?body.workshopAddress.trim():'',coverageAreas:[...new Set((areas as string[]).map(area=>area.trim()).filter(Boolean))]}};
}
