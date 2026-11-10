import { useEffect,useState } from "react";
import { Image,View } from "react-native";
import { useIsFocused } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { VideoView,useVideoPlayer } from "expo-video";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSessionUser,asActor } from "../../../core/session/session";
import { apiUrl,privateImageSource } from "../../../core/config/api";
import { localFileToBase64 } from "../../../core/constants/files";
import { PhotoError, photoErrorText, pickPhoto } from "../../../core/hooks/pickPhoto";
import { File as FsFile } from "expo-file-system";
import { towFleetService } from "../../tow/towService";
import { portalApi,portalBase } from "./api";
import type { ProviderArea,ProviderMedia } from "./types";
import { Async,Panel,Button,Pill,Text,EmptyState,useDT,go } from "./ui";

const VIDEO_MAX=20*1024*1024;
/** Reliable size: the picker's fileSize, else the file's own size on disk (Android content uris often omit fileSize). null = unknown. */
async function videoBytes(a:{uri:string;fileSize?:number|null}):Promise<number|null>{if(a.fileSize)return a.fileSize;try{const n=new FsFile(a.uri).size;return n>0?n:null;}catch{return null;}}
export function ProviderVideo({uri,headers}:{uri:string;headers?:Record<string,string>}){const d=useDT(),focused=useIsFocused(),player=useVideoPlayer({uri,headers},p=>{p.muted=true;});useEffect(()=>{if(!focused)player.pause();},[focused,player]);return <View style={{borderRadius:16,overflow:"hidden",backgroundColor:d.surface}}><VideoView player={player} nativeControls contentFit="contain" style={{width:"100%",height:190}}/></View>;}
function MediaAsset({media,area}:{media:ProviderMedia;area:ProviderArea}){const [source,setSource]=useState<{uri:string;headers?:Record<string,string>}|null>(null);useEffect(()=>{let live=true;privateImageSource(`${portalBase(area)}/media/${media.id}/asset`).then(s=>{if(live)setSource(s);});return()=>{live=false;};},[area,media.id]);return source?(media.mimeType.startsWith("video/")?<ProviderVideo {...source}/>:<Image source={source} style={{width:"100%",height:190,borderRadius:16}}/>):null;}
export function PublicMedia({media}:{media:ProviderMedia[]}){const d=useDT();return <>{media.map(m=><Panel key={m.id} title={m.slot==="VIDEO"?d.t("Truck / service video","فيديو الشاحنة / الخدمة"):m.slot==="PROFILE"?d.t("Profile photo","صورة الملف"):m.slot==="COVER"?d.t("Cover image","صورة الغلاف"):d.t("Business photos","صور النشاط")}>
 {m.mimeType.startsWith("video/")?<ProviderVideo uri={apiUrl(m.uri)}/>:<Image source={{uri:apiUrl(m.uri)}} style={{width:"100%",height:m.slot==="PROFILE"?140:190,borderRadius:16,resizeMode:"contain"}}/>}
 </Panel>)}</>;}
export default function MediaPage({area}:{area:ProviderArea}){
 const d=useDT(),u=useSessionUser(),state=useLoad(()=>portalApi.media(area),[u.id,area]);
 const fleet=useLoad(()=>area==="tow"?towFleetService.getMyFleet(asActor(u)):Promise.resolve(null),[u.id,area]);
 const [truckId,setTruck]=useState(""),[slot,setSlot]=useState("GALLERY"),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[remove,setRemove]=useState<string|null>(null);
 const work=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError(null);try{await fn();await state.reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const send=(replaceId:string|undefined,old:ProviderMedia|undefined,dataBase64:string)=>work(async()=>portalApi.upload(area,{slot:old?.slot??slot,truckId:(old?.truckId??truckId)||undefined,replaceId,dataBase64}));
 const pick=async(replaceId?:string,old?:ProviderMedia)=>{try{const video=(old?.slot??slot)==="VIDEO";
  if(!video){const photo=await pickPhoto();if(!photo)return;await send(replaceId,old,photo.base64);return;} // photos: resized, JPEG, size checked
  const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:["videos"],allowsEditing:false});if(r.canceled)return;const a=r.assets[0];if(!a)return;
  const size=await videoBytes(a);if(size===null)throw new Error(d.t("We could not read the size of that video. Choose another one.","تعذّر قراءة حجم الفيديو. اختر فيديو آخر."));
  if(size>VIDEO_MAX)throw new Error(d.t("Video too large. MP4 video: 20 MB.","الفيديو كبير. فيديو MP4: ٢٠ ميغابايت."));
  await send(replaceId,old,await localFileToBase64(a.uri));}catch(e){setError(e instanceof PhotoError?photoErrorText(e,d.t):(e as Error).message);}};
 return <ProviderLayout area={area} title={d.t("Media","الوسائط")} subtitle={d.t("Public presentation assets","وسائط العرض للعملاء")} onRefresh={state.reload}>
  <Panel title={d.t("Upload media","رفع وسائط")}><Text style={{color:d.muted,textAlign:d.align,lineHeight:21}}>{d.t("These assets appear in the customer profile. Verification documents remain private. Use JPEG/PNG/WebP up to 5 MB or H.264 MP4 up to 20 MB.","تظهر هذه الوسائط في ملف العميل. تبقى مستندات التحقق خاصة. صور JPEG/PNG/WebP حتى ٥ ميغابايت أو فيديو H.264 MP4 حتى ٢٠ ميغابايت.")}</Text>
   <View style={{flexDirection:d.row,flexWrap:"wrap",gap:6,marginVertical:10}}>{[["PROFILE","Profile photo","صورة الملف"],["COVER","Cover","الغلاف"],["GALLERY","Business photos","صور النشاط"],...(area==="tow"?[["VIDEO","Truck video","فيديو الشاحنة"]]:[])].map(([key,en,ar])=><Button key={key} size="sm" variant={slot===key?"primary":"ghost"} label={d.t(en,ar)} onPress={()=>setSlot(key)}/>)}</View>
   {area==="tow"?<><Button variant="ghost" label={d.t("Company media","وسائط الشركة")} onPress={()=>setTruck("")}/>{fleet.data?.trucks.map(t=><Button key={t.id} variant={truckId===t.id?"primary":"ghost"} label={`${t.make} ${t.model} · ${t.plate}`} onPress={()=>setTruck(t.id)}/>)}</>:null}
   <Button loading={busy} label={d.t("Choose and upload","اختيار ورفع")} onPress={()=>void pick()}/>
  </Panel>
  {error?<Panel tone="bad"><Text accessibilityRole="alert" style={{color:d.bad,textAlign:d.align}}>{error}</Text></Panel>:null}
  <Panel title={d.t("Existing published photos","الصور المنشورة الحالية")}><Text style={{color:d.muted,textAlign:d.align}}>{area==="tow"?d.t("Truck photos use the fleet record shown to customers. Open a truck to replace its photo.","صور الشاحنات من سجل الأسطول الظاهر للعملاء. افتح الشاحنة لاستبدال صورتها."):d.t("Product photos use each product's saved image. The existing verified storefront remains available in the customer preview.","صور المنتجات من الصورة المحفوظة لكل منتج. تبقى صورة واجهة المتجر الموثقة متاحة في معاينة العميل.")}</Text><Button variant="ghost" label={area==="tow"?d.t("Manage truck photos","إدارة صور الشاحنات"):d.t("Manage product photos","إدارة صور المنتجات")} onPress={()=>go(area==="tow"?"/provider/tow/trucks":"/provider/parts/products")}/></Panel>
  <Async state={state}>{items=><>{!items.length?<EmptyState icon="images-outline" text={d.t("No business media yet. Upload your first photo or video.","لا توجد وسائط للنشاط بعد. ارفع أول صورة أو فيديو.")}/>:items.map(m=><Panel key={m.id}><MediaAsset area={area} media={m}/><Pill tone="bronze" label={d.t("Customer-facing asset","وسائط مخصصة للعملاء")}/><Text style={{color:d.muted,textAlign:d.align,fontSize:12}}>{m.mimeType} · {(m.sizeBytes/1024/1024).toFixed(1)} MB</Text><Button disabled={busy} variant="ghost" label={d.t("Replace","استبدال")} onPress={()=>void pick(m.id,m)}/>{remove===m.id?<><Text style={{color:d.bad,textAlign:d.align}}>{d.t("Remove this media from the customer profile?","إزالة هذه الوسائط من ملف العميل؟")}</Text><Button disabled={busy} variant="danger" label={d.t("Confirm removal","تأكيد الإزالة")} onPress={()=>void work(()=>portalApi.remove(area,m.id)).then(()=>setRemove(null))}/><Button variant="ghost" label={d.t("Keep media","الاحتفاظ بالوسائط")} onPress={()=>setRemove(null)}/></>:<Button disabled={busy} variant="ghost" label={d.t("Remove","إزالة")} onPress={()=>setRemove(m.id)}/>}</Panel>)}</>}</Async>
 </ProviderLayout>;
}
