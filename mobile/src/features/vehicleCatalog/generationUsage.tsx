import {useState} from "react";
import {View} from "react-native";
import {Card,GButton,GText,Note} from "../../components/garage";
import {useL} from "../../core/hooks/useL";
import {useLoad} from "../../core/hooks/useLoad";
import {Confirm} from "./controls";
import {vehicleCatalog} from "./api";
import {threeDError} from "./lifecycleText";

const LABELS:[keyof NonNullable<ReturnType<typeof useLoad<Awaited<ReturnType<typeof vehicleCatalog.generationUsage>>>>["data"]>["usage"],string,string][]=[
 ["customerCars","Customer cars (saved in Garage)","سيارات العملاء (المحفوظة في الكراج)"],["products","Products listed for this car","منتجات مرتبطة بهذه السيارة"],["accessories","3D accessory fits","تركيبات الإكسسوارات ثلاثية الأبعاد"],
 ["requests","3D requests and imports","طلبات واستيرادات ثلاثية الأبعاد"],["model3d","A 3D model is attached","نموذج ثلاثي الأبعاد مرتبط"],["history","Tow / service / request history for this make and model","سجل السحب والصيانة والطلبات لهذه الشركة والطراز"]];
/** Delete a car generation only when nothing uses it; otherwise say why and offer to hide it instead. */
export function GenerationUsage({id,isActive=true,onDone}:{id:string;isActive?:boolean;onDone:()=>unknown}){
 const {t}=useL(),data=useLoad(()=>vehicleCatalog.generationUsage(id),[id]);const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[sure,setSure]=useState(false);
 const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError(null);try{await fn();await onDone();}catch(e){setError(threeDError(e,t));}finally{setBusy(false);}};
 const u=data.data;
 return <Card><GText>{t("Delete this car generation","حذف هذا الجيل")}</GText>
  {data.error?<Note tone="danger">{threeDError({message:data.error},t)}</Note>:null}
  {u?u.canDelete?<><Note>{t("Nothing uses this generation, so it can be deleted.","لا شيء يستخدم هذا الجيل، لذا يمكن حذفه.")}</Note><Confirm label={t("I want to delete it permanently","أريد حذفه نهائيًا")} value={sure} onChange={setSure}/><GButton variant="danger" label={t("Delete generation","حذف الجيل")} disabled={busy||!sure} onPress={()=>void run(()=>vehicleCatalog.remove("generations",id))}/></>
   :<><Note tone="warning">{t("It cannot be deleted because it is in use:","لا يمكن حذفه لأنه مستخدم:")}</Note>{LABELS.filter(([k])=>u.usage[k]>0).map(([k,en,ar])=><GText key={k}>{`• ${t(en,ar)}${k==="model3d"||k==="history"?"":`: ${u.usage[k]}`}`}</GText>)}
    {isActive?<GButton variant="secondary" label={t("Hide instead","إخفاء بدلًا من الحذف")} disabled={busy} onPress={()=>void run(()=>vehicleCatalog.save("generations",id,{isActive:false}))}/>:<GText soft>{t("It is already hidden (inactive).","وهو مخفي بالفعل (غير نشط).")}</GText>}</>:null}
  {error?<Note tone="danger">{error}</Note>:null}</Card>;
}
