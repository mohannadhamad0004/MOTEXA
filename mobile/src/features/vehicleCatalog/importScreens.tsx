import {router,useLocalSearchParams,type Href} from "expo-router";
import {useEffect,useRef,useState} from "react";
import {Image,Linking,View} from "react-native";
import {Card,GarageHero,GaragePage,GButton,GText,Note} from "../../components/garage";
import {useL} from "../../core/hooks/useL";
import {useLoad} from "../../core/hooks/useLoad";
import {useGarageTheme} from "../../theme/garage";
import {catalogService} from "../catalog/catalogService";
import {refreshRuntimeModels} from "../car3d/runtimeModels";
import {Choice,Confirm,Entry} from "./controls";
import {vehicleCatalog,type ModelImport,type SketchfabInspection} from "./api";
import {ImportReview} from "./screens";
import {importError,IMPORT_ERROR_LABELS,IMPORT_LABELS,runningImport,validYears} from "./importState";

function WebLink({url,label}:{url:string|null;label:string}){
 const {t}=useL();const [failed,setFailed]=useState(false);
 return url?<><GButton variant="ghost" label={label} onPress={()=>{void Linking.openURL(url).catch(()=>setFailed(true));}}/>{failed?<Note>{t("Could not open the link.","تعذّر فتح الرابط.")}</Note>:null}</>:null;
}
export function InspectionCard({inspection:s}:{inspection:SketchfabInspection}){
 const {t}=useL();const {align}=useGarageTheme();
 return <Card>
  {s.thumbnail?<Image accessibilityLabel={t("Sketchfab model thumbnail","صورة النموذج من Sketchfab")} source={{uri:s.thumbnail}} style={{width:"100%",height:160,borderRadius:12}} resizeMode="contain"/>:null}
  <GText style={align}>{s.title}</GText><GText soft style={align}>{`${t("by","بواسطة")} ${s.author}`}</GText>
  <GText style={align}>{`${t("License","الترخيص")}: ${s.license}`}</GText>
  <GText style={align}>{`${t("Downloadable","متاح للتنزيل")}: ${s.downloadable?t("Yes","نعم"):t("No","لا")}`}</GText>
  <GText soft style={align}>{t("Sketchfab UID","معرّف Sketchfab")}</GText><GText selectable style={{textAlign:"left",writingDirection:"ltr"}}>{s.uid}</GText>
  <WebLink url={s.url} label={t("View on Sketchfab","عرض على Sketchfab")}/>
  <WebLink url={s.authorUrl} label={t("Creator profile","صفحة المنشئ")}/>
  <WebLink url={s.licenseUrl} label={t("Read license","قراءة الترخيص")}/>
  {!s.allowed?<Note tone="danger">{t(...(IMPORT_ERROR_LABELS[s.refusalCode??"LICENSE_NOT_ALLOWED"]??IMPORT_ERROR_LABELS.LICENSE_NOT_ALLOWED))}</Note>:null}
  {s.duplicate?<><Note tone="warning">{`${t(...IMPORT_ERROR_LABELS.DUPLICATE_IMPORT)} ${s.duplicate.name}`}</Note>{s.duplicate.importId?<GButton variant="secondary" label={t("Open existing import","فتح الاستيراد الموجود")} onPress={()=>router.push(`/dept/vehicles/imports/${s.duplicate!.importId}` as Href)}/>:s.duplicate.model3dKey?<GButton variant="secondary" label={t("Open this 3D model","فتح هذا النموذج")} onPress={()=>router.push(`/dept/3d/vehicles/${s.duplicate!.model3dKey}` as Href)}/>:null}</>:null}
  {s.allowed&&!s.duplicate?<Note>{t("License accepted. No model has been downloaded yet.","الترخيص مقبول. لم يُنزّل النموذج بعد.")}</Note>:null}
 </Card>;
}
export function NewSketchfabImport(){
 const params=useLocalSearchParams<{generationId?:string;url?:string}>();const assigned=useRef(false);
 const {t,isArabic}=useL();const {row}=useGarageTheme();const taxonomy=useLoad(vehicleCatalog.list,[]);
 const [url,setUrl]=useState(params.url??""),[inspection,setInspection]=useState<SketchfabInspection|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [brandId,setBrand]=useState(""),[modelId,setModel]=useState(""),[generationId,setGeneration]=useState("");
 const [createKind,setCreateKind]=useState<string|null>(null),[name,setName]=useState(""),[arabicName,setArabicName]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
 useEffect(()=>{if(assigned.current||!params.generationId||!taxonomy.data)return;const v=taxonomy.data.vehicles.find(v=>v.generations.some(g=>g.id===params.generationId)),g=v?.generations.find(g=>g.id===params.generationId);if(v&&g){setBrand(v.brandId??"");setModel(v.id);setGeneration(g.id);setFrom(String(g.yearFrom));setTo(String(g.yearTo));assigned.current=true;}},[params.generationId,taxonomy.data]);
 const request=useRef(0);useEffect(()=>()=>{request.current++;},[]);
 const brands=taxonomy.data?.brands.filter(b=>b.isActive)??[],models=taxonomy.data?.vehicles.filter(v=>v.brandId===brandId&&v.isActive)??[];
 const selected=models.find(v=>v.id===modelId),generations=selected?.generations.filter(g=>g.isActive)??[],generation=generations.find(g=>g.id===generationId);
 const work=async(fn:()=>Promise<void>)=>{setError(null);setBusy(true);try{await fn();}catch(e){setError(importError(e,t));}finally{setBusy(false);}};
 const inspect=async()=>{
  const mine=++request.current;setInspection(null);setError(null);setBusy(true);
  try{const current=await vehicleCatalog.inspect(url.trim());if(mine===request.current)setInspection(current);}
  catch(e){if(mine===request.current)setError(importError(e,t));}
  finally{if(mine===request.current)setBusy(false);}
 };
 const chooseGeneration=(id:string)=>{setGeneration(id);const g=generations.find(g=>g.id===id);setFrom(g?String(g.yearFrom):"");setTo(g?String(g.yearTo):"");};
 const startCreate=(kind:string)=>{setCreateKind(kind);setName("");setArabicName("");if(kind==="generations"){setFrom("");setTo("");setGeneration("");}};
 return <GaragePage hero={<GarageHero variant="detail" title={t("Import from Sketchfab","استيراد من Sketchfab")} line={t("Inspect the source, choose a managed generation, then import privately for review.","افحص المصدر واختر جيلًا من الكتالوج، ثم استورد النموذج بشكل خاص للمراجعة.")} backLabel={t("Back","رجوع")} onBack={()=>router.back()}/>}>
  <View style={{gap:14,minWidth:0}}>
   <Card><Entry url editable={!busy} label={t("Sketchfab model URL","رابط النموذج من Sketchfab")} value={url} onChange={value=>{request.current++;setUrl(value);setInspection(null);setError(null);}}/>
    <GText soft>{t("https://sketchfab.com/3d-models/…","https://sketchfab.com/3d-models/…")}</GText>
    <GButton label={busy?t("Inspecting…","جارٍ الفحص…"):t("Inspect link","فحص الرابط")} disabled={busy||!url.trim()} onPress={()=>void inspect()}/>
    <Note>{t("Only downloadable CC0, CC BY and CC BY-SA models are accepted. Downloads and API access run on the backend.","تُقبل النماذج المتاحة للتنزيل بترخيص CC0 أو CC BY أو CC BY-SA فقط. ينفّذ الخادم التنزيل والوصول إلى الواجهة البرمجية.")}</Note>
   </Card>
   {error?<Note tone="danger">{error}</Note>:null}
   {inspection?<InspectionCard inspection={inspection}/>:null}
   <Card><GText>{t("Vehicle taxonomy","تصنيف المركبة")}</GText>
    {taxonomy.error?<Note tone="danger">{t("Could not load the managed catalog.","تعذّر تحميل كتالوج المركبات.")}</Note>:null}
    <Choice label={t("Make / Brand","الشركة / العلامة")} value={brandId} options={brands.map(b=>({id:b.id,label:isArabic?b.nameAr:b.name}))} onChange={id=>{setBrand(id);setModel("");setGeneration("");setFrom("");setTo("");}}/>
    <GButton variant="ghost" label={t("Create missing brand","إضافة شركة غير موجودة")} disabled={busy} onPress={()=>startCreate("brands")}/>
    <Choice label={t("Model","الطراز")} value={modelId} options={models.map(v=>({id:v.id,label:isArabic?v.modelAr:v.model}))} onChange={id=>{setModel(id);setGeneration("");setFrom("");setTo("");}}/>
    <GButton variant="ghost" label={t("Create missing model","إضافة طراز غير موجود")} disabled={busy||!brandId} onPress={()=>startCreate("models")}/>
    <Choice label={t("Generation / Edition","الجيل / الإصدار")} value={generationId} options={generations.map(g=>({id:g.id,label:`${isArabic?g.nameAr:g.code} (${g.yearFrom}–${g.yearTo})`}))} onChange={chooseGeneration}/>
    <GButton variant="ghost" label={t("Create missing generation","إضافة جيل غير موجود")} disabled={busy||!modelId} onPress={()=>startCreate("generations")}/>
    {createKind?<View style={{gap:10}}><GText>{t("Create in managed catalog","إضافة إلى كتالوج المركبات")}</GText>
      <Entry label={createKind==="generations"?t("Generation code","رمز الجيل"):t("Name in English","الاسم بالإنجليزية")} value={name} onChange={setName}/>
      <Entry label={t("Arabic name","الاسم بالعربية")} value={arabicName} onChange={setArabicName}/>
      {createKind!=="brands"?<><Entry numeric label={t("Year from","من سنة")} value={from} onChange={setFrom}/><Entry numeric label={t("Year to","إلى سنة")} value={to} onChange={setTo}/></>:null}
      <View style={[row,{gap:8,flexWrap:"wrap"}]}><GButton label={t("Save taxonomy","حفظ التصنيف")} disabled={busy||!name.trim()||createKind!=="brands"&&!validYears(Number(from),Number(to))} onPress={()=>void work(async()=>{
       const years={yearFrom:Number(from),yearTo:Number(to)};
       const body=createKind==="brands"?{name:name.trim(),nameAr:arabicName.trim()||name.trim()}:createKind==="models"?{brandId,model:name.trim(),modelAr:arabicName.trim()||name.trim(),...years}:{vehicleId:modelId,code:name.trim(),nameAr:arabicName.trim()||name.trim(),...years};
       const saved=await vehicleCatalog.save(createKind,null,body);await taxonomy.reload();if(createKind==="brands"){setBrand(saved.id);setModel("");setGeneration("");}else if(createKind==="models"){setModel(saved.id);setGeneration("");}else setGeneration(saved.id);setCreateKind(null);
      })}/><GButton variant="ghost" label={t("Cancel","إلغاء")} disabled={busy} onPress={()=>setCreateKind(null)}/></View>
    </View>:<><Entry numeric editable={false} label={t("Year from","من سنة")} value={generation?String(generation.yearFrom):""} onChange={()=>{}}/><Entry numeric editable={false} label={t("Year to","إلى سنة")} value={generation?String(generation.yearTo):""} onChange={()=>{}}/></>}
    <GButton variant="ghost" label={t("Manage existing taxonomy / years","إدارة التصنيفات والسنوات الموجودة")} onPress={()=>router.push("/dept/vehicles" as Href)}/>
   </Card>
   <GButton label={busy?t("Working…","جارٍ العمل…"):t("Import for private review","استيراد للمراجعة الخاصة")} disabled={busy||!inspection?.allowed||!!inspection.duplicate||!generation||!!createKind} onPress={()=>void work(async()=>{
     if(!generation)return;const r=await vehicleCatalog.importSketchfab({url:inspection!.url,generationId:generation.id,yearFrom:generation.yearFrom,yearTo:generation.yearTo});router.replace(`/dept/vehicles/imports/${r.id}` as Href);
   })}/>
  </View>
 </GaragePage>;
}

export function ImportProgress({record:r}:{record:ModelImport}){
 const {t}=useL();const {g,align}=useGarageTheme();
 return <Card><GText style={align}>{t(...(IMPORT_LABELS[r.status]??IMPORT_LABELS.DRAFT))}</GText>
  {typeof r.progress==="number"?<><View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:r.progress}} accessibilityLabel={t("Import stage progress","تقدم مراحل الاستيراد")} style={{height:8,backgroundColor:g.cardSoft,borderRadius:4,overflow:"hidden"}}><View style={{width:`${Math.max(0,Math.min(100,r.progress))}%`,height:8,backgroundColor:g.accent,alignSelf:align.textAlign==="right"?"flex-end":"flex-start"}}/></View><GText soft style={align}>{`${r.progress}% · ${t("Stage progress","تقدم المراحل")}`}</GText></>:null}
  {runningImport(r.status)?<Note>{t("Preparation continues on the server. You can leave this screen and return later.","يستمر تجهيز النموذج على الخادم. يمكنك مغادرة هذه الشاشة والعودة لاحقًا.")}</Note>:null}
  {r.errorCode?<Note tone="danger">{t(...(IMPORT_ERROR_LABELS[r.errorCode]??IMPORT_ERROR_LABELS.VALIDATION_REJECTED))}</Note>:null}
 </Card>;
}
export function SketchfabImportReview(){
 const {id}=useLocalSearchParams<{id:string}>();const {t}=useL();const {align}=useGarageTheme();
 const loaded=useLoad(()=>vehicleCatalog.getImport(id),[id],2500);const r=loaded.data;
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[discard,setDiscard]=useState(false);
 const work=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError(null);try{await fn();await loaded.reload();catalogService.invalidateVehicleList();await refreshRuntimeModels();}catch(e){setError(importError(e,t));}finally{setBusy(false);}};
 const s=r?.provenance;
 return <GaragePage hero={<GarageHero variant="detail" title={t("Vehicle import review","مراجعة استيراد المركبة")} line={r?`${r.make} ${r.model} ${r.code} · ${r.yearFrom}–${r.yearTo}`:t("Loading…","جارٍ التحميل…")} backLabel={t("Back to catalog","العودة إلى الكتالوج")} onBack={()=>router.replace("/dept/vehicles" as Href)}/>} onRefresh={()=>void loaded.reload()}>
  <View style={{gap:14,minWidth:0}}>
   {loaded.error?<Note tone="danger">{t("Could not load this import. Parts Admin access is required.","تعذّر تحميل هذا الاستيراد. يلزم صلاحية إدارة قطع الغيار.")}</Note>:null}
   {error?<Note tone="danger">{error}</Note>:null}
   {r?<><ImportProgress record={r}/>
    {s?<Card><GText style={align}>{s.title}</GText><GText style={align}>{`${t("Creator","المنشئ")}: ${r.author}`}</GText><GText style={align}>{`${t("License","الترخيص")}: ${r.license}`}</GText>
      <GText soft style={align}>{`${t("Inspected","تاريخ الفحص")}: ${new Date(s.inspectedAt).toLocaleString()}`}</GText>
      <GText soft style={align}>{`${t("Sketchfab UID","معرّف Sketchfab")}: ${s.uid}`}</GText>
      <WebLink url={r.sourceUrl} label={t("Original model","النموذج الأصلي")}/><WebLink url={s.authorUrl} label={t("Creator profile","صفحة المنشئ")}/><WebLink url={s.licenseUrl} label={t("Read license","قراءة الترخيص")}/>
      {s.originalDownloadedBytes!==null?<GText style={align}>{`${t("Original download","التنزيل الأصلي")}: ${(s.originalDownloadedBytes/1048576).toFixed(2)} MiB`}</GText>:null}
      {r.validation?.bytes?<GText style={align}>{`${t("Prepared GLB","ملف GLB المجهّز")}: ${(Number(r.validation.bytes)/1048576).toFixed(2)} MiB`}</GText>:null}
      {s.optimization?.warnings.map(w=><Note key={w}>{t(w,w.includes("Paint")?"يتطلب تحديد أسطح الطلاء مراجعة؛ التلوين التلقائي معطّل.":w.includes("Front")?"يتطلب اتجاه المقدمة تأكيدًا بصريًا.":"لم تُحذف المقصورة لأن أسماء العناصر غير واضحة.")}</Note>)}
    </Card>:null}
    {r.status==="READY"||r.status==="PUBLISHED"||r.status==="FAILED"&&r.hasRawModel||!r.provenance&&r.status!=="DISCARDED"?<><ImportReview key={`${r.id}-${r.status}-${r.validation?.validatedAt}-${r.existingModel3dKey}`} r={r} work={work} busy={busy}/>
      <Card><GText style={align}>{t("Part-map proposal","اقتراح خريطة القطع")}</GText><GText style={align}>{r.partMapStatus==="CONFIRMED"?t("Confirmed for this exact GLB revision.","مؤكدة لهذه النسخة المحددة من GLB."):r.validation?.partMap?t("Saved for this exact GLB revision. Unresolved parts remain available for admin review.","حُفظ الاقتراح لهذه النسخة من GLB. تبقى القطع غير المحددة متاحة لمراجعة الإدارة."):t("No automatic proposal available.","لا يوجد اقتراح تلقائي.")}</GText>
       {r.status==="READY"?<GButton label={t("Review part map privately","مراجعة خريطة القطع بشكل خاص")} onPress={()=>router.push(`/dept/accessory-zones?key=${encodeURIComponent(`import-${r.id}`)}` as Href)}/>:null}
       {r.status==="PUBLISHED"?<><Note>{t("Published to the selected managed generation. Matching Garage cars receive it through the runtime catalog.","نُشر النموذج للجيل المحدد في الكتالوج. تستلمه سيارات الكراج المطابقة عبر كتالوج العرض.")}</Note><GText soft style={align}>{r.publishedModel3dKey}</GText><GButton label={t("Confirm part map","تأكيد خريطة القطع")} onPress={()=>router.push(`/dept/accessory-zones?model3dKey=${encodeURIComponent(r.publishedModel3dKey??"")}` as Href)}/></>:null}
      </Card></>:null}
    {r.status==="FAILED"?<GButton label={t("Retry this import","إعادة محاولة هذا الاستيراد")} disabled={busy} onPress={()=>void work(()=>vehicleCatalog.retry(r.id))}/>:null}
    {!["PUBLISHED","DISCARDED"].includes(r.status)?<Card><Confirm label={t("Discard this unpublished import and its private prepared files","استبعاد هذا الاستيراد غير المنشور وملفاته المجهّزة الخاصة")} value={discard} onChange={setDiscard}/><GButton variant="danger" label={t("Discard","استبعاد")} disabled={!discard||busy} onPress={()=>void work(()=>vehicleCatalog.discard(r.id))}/></Card>:null}
    {r.status==="DISCARDED"?<Note>{t("This import was discarded. Its source history is retained for audit and duplicate detection.","استُبعد هذا الاستيراد. يُحتفظ بسجل المصدر للتدقيق واكتشاف التكرار.")}</Note>:null}
   </>:null}
  </View>
 </GaragePage>;
}
