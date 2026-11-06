import { useMemo,useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ProviderLayout } from "../../components/layout/ProviderLayout";
import { useLoad } from "../../core/hooks/useLoad";
import { portalApi } from "../provider/portal/api";
import type { Provider3dProduct } from "../provider/portal/types";
import { Car3DView } from "../car3d/Car3DView";
import { useCatalogModelKey } from "../car3d/runtimeModels";
import type { CarModel } from "../car3d/models";
import type { Kit } from "../car3d/useCar3D";
import { CAR_COLORS,DEFAULT_COLOR,NO_ADJUST } from "../car3d/car3d";
import { ACCESSORY_TYPE_LABELS,shopAccessoryApi,bumperLabel,isBumper } from "./api";
import { fitLabel,replacementLabel } from "./fitPresentation";
import { Async,Panel,Text,Button,EmptyState,useDT } from "../provider/portal/ui";

function Preview({product:p}:{product:Provider3dProduct}){
 const d=useDT(),[selected,setSelected]=useState(p.parts.find(x=>x.hasModel)?.part??"MAIN"),[genId,setGenId]=useState(""),[off,setOff]=useState<string[]>([]),[paint,setPaint]=useState(false),[color,setColor]=useState(DEFAULT_COLOR),[error,setError]=useState<string|null>(null);
 const selectedPart=p.parts.find(x=>x.part===selected),gens=[...new Map(p.parts.flatMap(x=>x.generations).map(g=>[g.id,g])).values()],gen=gens.find(g=>g.id===genId),car=useCatalogModelKey(gen?.model3dKey);
 const standalone=useMemo<CarModel>(()=>({key:`provider-${selectedPart?.id??"none"}`,generation:p.name,lengthM:1.4,rotateY:0,groundOffset:0,paintNodes:[],paintMaterials:[],rimsSwappable:false,wing:{x:0,y:0,z:0,scale:1},rack:{x:0,y:0,z:0,scale:1},credit:{title:p.name,author:"",url:"",license:""}}),[p.name,selectedPart?.id]);
 const kits=useMemo<Kit[]>(()=>p.parts.filter(a=>a.hasModel&&!off.includes(a.part)&&a.generations.some(g=>g.id===genId&&g.fitState!=="FAILED")&&(!isBumper(a.type)||!!car?.partMap?.[bumperLabel(a.type)])).map(a=>{const f=a.generations.find(g=>g.id===genId);return {type:a.type,file:`provider-${a.id}.glb`,assetLoader:()=>shopAccessoryApi.asset(p.id,"model",a.part),paintMatch:paint,adj:NO_ADJUST,fit:f?.autoFit?.fit,baseAdj:f?.autoFit?.adj,size:{},};}),[p,off,genId,car,paint]);
 // The same production renderer handles standalone models and fitted kits. Private assets use authenticated memory-only loaders.
 return <>
  <Panel title={d.t("Preview mode","نوع المعاينة")}><Button variant={!genId?"primary":"ghost"} label={d.t("Standalone accessory","القطعة منفردة")} onPress={()=>{setGenId("");setError(null);}}/>{gens.map(g=><Button key={g.id} variant={genId===g.id?"primary":"ghost"} disabled={!g.has3d} label={`${d.t("View on car","عرض على سيارة")}: ${d.ar?g.nameAr:g.name}`} onPress={()=>{setGenId(g.id);setOff([]);setError(null);}}/>)}</Panel>
  {!p.parts.some(x=>x.hasModel)?<EmptyState icon="cube-outline" text={d.t("No model available yet. Submit your photos for Parts Admin review.","لا يوجد نموذج متاح بعد. أرسل صورك لمراجعة إدارة القطع.")}/>:!genId?<>
    <View style={{flexDirection:d.row,flexWrap:"wrap",gap:8,marginBottom:12}}>{p.parts.filter(a=>a.hasModel).map(a=><Button key={a.part} variant={selected===a.part?"primary":"ghost"} label={d.t(...ACCESSORY_TYPE_LABELS[a.type])} onPress={()=>setSelected(a.part)}/>)}</View>
    {selectedPart?.hasModel?<Car3DView key={selectedPart.id} model={standalone} assetLoader={()=>shopAccessoryApi.asset(p.id,"model",selectedPart.part)} color={color} bg={d.paper} interactive style={{height:360,borderRadius:20}}/>:null}
   </>:car?<>
    <Car3DView key={genId} model={car} kits={kits} color={color} bg={d.paper} interactive onFitError={()=>setError(d.t("The accessory could not be placed cleanly on this car.","تعذّر تركيب القطعة بدقة على هذه السيارة."))} style={{height:360,borderRadius:20}}/>
    {!kits.length?<Text style={{color:d.warn,textAlign:d.align}}>{d.t("No enabled part can currently be previewed on this car. Bumpers require the confirmed stock-part map.","لا توجد قطعة مفعّلة قابلة للمعاينة على هذه السيارة. تتطلب المصدات خريطة قطع أصلية مؤكدة.")}</Text>:null}
    {p.parts.filter(a=>a.generations.some(g=>g.id===genId)).map(a=>{const g=a.generations.find(g=>g.id===genId)!;return <Panel key={a.id} title={d.t(...ACCESSORY_TYPE_LABELS[a.type])}><Text style={{color:d.muted,textAlign:d.align}}>{fitLabel(g.fitState,d.t)}</Text><Text style={{color:d.muted,textAlign:d.align}}>{d.t("Replaces: ","يستبدل: ")}{replacementLabel(g.replacement,d.t)}</Text><Button variant="ghost" label={off.includes(a.part)?d.t("Turn accessory ON","تشغيل القطعة"):d.t("Turn accessory OFF","إيقاف القطعة")} onPress={()=>setOff(v=>v.includes(a.part)?v.filter(x=>x!==a.part):[...v,a.part])}/></Panel>;})}
    <Button variant="ghost" label={paint?d.t("Keep original finish","الاحتفاظ باللون الأصلي"):d.t("Paint to match car","مطابقة لون السيارة")} onPress={()=>setPaint(v=>!v)}/>
    <View style={{flexDirection:d.row,flexWrap:"wrap",gap:6}}>{CAR_COLORS.map(c=><Button key={c.hex} size="sm" variant={color===c.hex?"primary":"ghost"} label={d.t(c.en,c.ar)} onPress={()=>setColor(c.hex)}/>)}</View>
   </>:<Text style={{color:d.muted,textAlign:d.align}}>{d.t("Loading the active vehicle model…","جارٍ تحميل نموذج السيارة النشط…")}</Text>}
  {error?<Text accessibilityRole="alert" style={{color:d.bad,textAlign:d.align}}>{error}</Text>:null}
  <Text style={{color:d.muted,textAlign:d.align,fontSize:12,lineHeight:19,marginTop:14}}>{d.t("Owner preview. Unpublished models are private. Fit approval and final publication remain with Parts Admin. Real fit may differ from the 3D preview.","معاينة المالك. النماذج غير المنشورة خاصة. يبقى اعتماد التركيب والنشر النهائي لدى إدارة القطع. قد يختلف التركيب الفعلي عن المعاينة.")}</Text>
 </>;
}
export default function ProviderPreview(){const {productId}=useLocalSearchParams<{productId:string}>(),d=useDT(),state=useLoad(()=>portalApi.product3d(productId),[productId]);return <ProviderLayout area="parts" title={state.data?.name??d.t("3D preview","معاينة ثلاثية الأبعاد")} onRefresh={state.reload}><Async state={state}>{p=><Preview key={p.id} product={p}/>}</Async></ProviderLayout>;}
