import {useEffect,useSyncExternalStore} from "react";
import {Directory,File,Paths} from "expo-file-system";
import {Platform} from "react-native";
import {api} from "../../core/config/api";
import {useSessionUser} from "../shared/session";
import {CAR_MODELS,type CarModel} from "./models";
import type {Car} from "../catalog/myCar";
import {parseCatalog,offlineCatalog,type CatalogSnapshot} from "./runtimeCatalog";
let models:CarModel[]=[],saved:CatalogSnapshot|null=null,pending:Promise<void>|null=null,hydrated=false;
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(l=>l());
const subscribe=(l:()=>void)=>{listeners.add(l);return()=>{listeners.delete(l);};};
const snapshot=()=>models;
const CACHE="motexa-approved-3d-catalog-v2";
function nativeCache(){const d=new Directory(Paths.document,"car3d");d.create({idempotent:true,intermediates:true});return new File(d,CACHE+".json");}
async function hydrate(){
  if(hydrated)return;hydrated=true;
  try{
    const raw=Platform.OS==="web"?localStorage.getItem(CACHE):nativeCache().exists?await nativeCache().text():null;
    if(!raw)return;const record=JSON.parse(raw);if(typeof record?.checkedAt!=="number"||!Number.isFinite(record.checkedAt))return;
    const parsed=parseCatalog(record,record.checkedAt,CAR_MODELS);
    if(parsed){saved=parsed;models=offlineCatalog(saved,CAR_MODELS);emit();}
  }catch{/* Offline with no validated manifest fails closed to coming soon. */}
}
export function refreshRuntimeModels(){
  if(!pending)pending=(async()=>{
    await hydrate();
    try{
      const next=parseCatalog(await api<unknown>("GET","/catalog/3d-models"),Date.now(),CAR_MODELS);
      if(!next){saved=null;models=[];emit();try{if(Platform.OS==="web")localStorage.removeItem(CACHE);else if(nativeCache().exists)nativeCache().delete();}catch{}return;}
      saved=next;models=next.models;emit();
      try{const text=JSON.stringify(next);if(Platform.OS==="web")localStorage.setItem(CACHE,text);else{const file=nativeCache();if(!file.exists)file.create();await file.write(text);}}catch{/* Cache failure does not hide a valid online catalog. */}
    }catch{models=offlineCatalog(saved,CAR_MODELS);emit();}
  })().finally(()=>{pending=null;});
  return pending;
}
export function useCatalogModel(car:Pick<Car,"generation">|null){
  const user=useSessionUser();const list=useSyncExternalStore(subscribe,snapshot,snapshot);
  useEffect(()=>{if(user.id)void refreshRuntimeModels();const timer=setInterval(()=>{if(user.id)void refreshRuntimeModels();},60000);return()=>clearInterval(timer);},[user.id,car?.generation?.model3dKey]);
  return list.find(m=>m.key===car?.generation?.model3dKey)??null;
}
