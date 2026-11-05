import type {CarModel} from "./models";
import {parseCarModel} from "./modelConfig";
export const CATALOG_CACHE_TTL=24*60*60*1000;
export type CatalogSnapshot={revision:string;checkedAt:number;models:CarModel[];activeKeys:string[]};
export function parseCatalog(value:unknown,now=Date.now(),builtins:CarModel[]=[]):CatalogSnapshot|null{
  const data=value as {revision?:unknown;models?:unknown;activeKeys?:unknown};
  if(!data||typeof data.revision!=="string"||!/^[a-f0-9]{64}$/.test(data.revision)||!Array.isArray(data.models)||data.models.length>2000)return null;
  const models:CarModel[]=[],seen=new Set<string>();
  for(const raw of data.models){const m=parseCarModel(raw);if(!m||seen.has(m.key))return null;seen.add(m.key);models.push(m);}
  const active=data.activeKeys??models.map(m=>m.key);
  if(!Array.isArray(active)||active.length>2000||active.some(k=>typeof k!=="string"||!/^[a-z0-9][a-z0-9-]{0,150}$/.test(k))||new Set(active).size!==active.length)return null;
  const server=new Map(models.map(m=>[m.key,m])),fallback=new Map(builtins.map(m=>[m.key,m]));
  return {revision:data.revision,checkedAt:now,activeKeys:active,models:active.flatMap(key=>{const m=server.get(key)??parseCarModel(fallback.get(key));return m?[m]:[];})};
}
/** The last server active-key set is authoritative; removed keys never return from built-in fallback. */
export function offlineCatalog(saved:CatalogSnapshot|null,builtins:CarModel[],now=Date.now()):CarModel[]{
  if(!saved||!Number.isFinite(saved.checkedAt)||saved.checkedAt>now+60000||now-saved.checkedAt>CATALOG_CACHE_TTL)return [];
  const fallback=new Map(builtins.map(m=>[m.key,m]));
  return saved.models.filter(m=>saved.activeKeys.includes(m.key)).flatMap(raw=>{const m=parseCarModel(raw)??fallback.get(raw.key);return m?[m]:[];});
}
