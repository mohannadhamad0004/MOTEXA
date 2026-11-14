import {router,useLocalSearchParams,type Href} from "expo-router";
import {useState} from "react";
import {View} from "react-native";
import {Card,GButton,GText,Note} from "../../components/garage";
import {useL} from "../../core/hooks/useL";
import {useLoad} from "../../core/hooks/useLoad";
import {DeptPage,Section as DeptSection,Pill} from "../department/ui";
import {vehicleCatalog} from "./api";
import {UploadModel} from "./screens";
import {GenerationUsage} from "./generationUsage";
import {Car3DView} from "../car3d/Car3DView";
import {refreshRuntimeModels} from "../car3d/runtimeModels";
import {useGarageTheme} from "../../theme/garage";
import {GateSummary} from "../accessory3d/gate";
import {Entry,Confirm} from "./controls";
import {modelApi,type Managed3DModel,type ModelStatus,type DeleteImpact} from "./modelApi";
import {threeDError} from "./lifecycleText";
import {ItemRow} from "../../components/ItemActionsMenu";
import {modelActions,importActions} from "../department/itemActions";
const go=(path:string)=>router.push(path as Href);
const STATUS:Record<ModelStatus,{en:string;ar:string;tone:"ok"|"amber"|"bad"|"neutral"}>={PUBLISHED:{en:"Published",ar:"منشور",tone:"ok"},HIDDEN:{en:"Hidden",ar:"مخفي",tone:"neutral"},IN_REVIEW:{en:"In review",ar:"قيد المراجعة",tone:"amber"},FAILED:{en:"Failed",ar:"فشل",tone:"bad"}};
function StatusChip({s}:{s:ModelStatus}){const {t}=useL();return <Pill tone={STATUS[s].tone} label={t(STATUS[s].en,STATUS[s].ar)}/>;}
const BODY_TYPES=[["sedan","Sedan","سيدان"],["hatchback","Hatchback","هاتشباك"],["suv","SUV","دفع رباعي"],["van","Van","فان"],["pickup","Pickup","بيك أب"]] as const;

export function ThreeDHub(){const {t}=useL();return <DeptPage back><DeptSection title={t("3D workspace","مساحة العمل ثلاثية الأبعاد")} caption={t("Requests, reviewed models and publication.","الطلبات والنماذج المعتمدة والنشر.")}/><View style={{gap:12}}>{[
 ["3D requests","طلبات ثلاثية الأبعاد","/dept/3d/requests"], ["Vehicle 3D Models","نماذج السيارات ثلاثية الأبعاد","/dept/3d/vehicles"], ["Accessory 3D Models","نماذج القطع ثلاثية الأبعاد","/dept/3d/accessories"], ["Add by Link","إضافة برابط","/dept/vehicles/imports/new"], ["Manual Import","استيراد يدوي","/dept/vehicles?section=imports"], ["Part Maps","خرائط القطع","/dept/accessory-zones?mode=parts"], ["Fit Review","مراجعة التركيب","/dept/accessory-zones?mode=fits"], ["Vehicle taxonomy","تصنيف المركبات","/dept/vehicles"],
 ].map(([en,ar,path])=><GButton key={path} variant="secondary" label={t(en,ar)} onPress={()=>go(path)}/>)}</View></DeptPage>;}
/** "Limited: bumpers not separate" etc.: what this car's current model cannot show as a replacement part. */
const LIMIT_LABEL:Record<string,[string,string]>={FRONT_BUMPER:["front bumper","المصد الأمامي"],REAR_BUMPER:["rear bumper","المصد الخلفي"],MIRROR_COVERS:["mirror covers","أغطية المرايا"],RIMS:["rims","الجنوط"],SIDE_SKIRTS:["side skirts","التنانير الجانبية"]};
export function LimitNote({limits,generationId,action=true}:{limits:Partial<Record<string,string>>;generationId:string;action?:boolean}){
 const {t}=useL();const keys=Object.keys(limits);if(!keys.length)return null;
 const bumpers=keys.includes("FRONT_BUMPER")||keys.includes("REAR_BUMPER");
 return <View style={{gap:6}}><Pill tone="amber" label={bumpers?t("Limited: bumpers not separate","محدود: المصدات غير منفصلة"):t("Limited parts","قطع محدودة")}/><GText soft>{`${t("Can't show a replacement","لا يمكنه عرض بديل لـ")}: ${keys.map(k=>t(...(LIMIT_LABEL[k]??[k,k]))).join(", ")}`}</GText>{action?<GButton variant="secondary" label={t("Replace model","استبدال النموذج")} onPress={()=>go(`/dept/3d/add?generationId=${generationId}`)}/>:null}</View>;
}
const RUNNING=["QUEUED","DOWNLOADING","CONVERTING","OPTIMIZING","VALIDATING","GENERATING_PART_MAP"];
const IMPORT_CHIP=(status:string):{en:string;ar:string;tone:"ok"|"amber"|"bad"|"neutral"}=>status==="READY"?{en:"Ready for review",ar:"جاهز للمراجعة",tone:"amber"}:status==="FAILED"?{en:"Import failed",ar:"فشل الاستيراد",tone:"bad"}:status==="DISCARDED"?{en:"Discarded",ar:"مستبعد",tone:"neutral"}:RUNNING.includes(status)?{en:"Preparing",ar:"قيد التجهيز",tone:"neutral"}:{en:"Waiting for validation",ar:"بانتظار التحقق",tone:"amber"};
type Filter=ModelStatus|"ALL"|"IMPORTS";
/** Every car with any 3D: catalog models (published / hidden / in review / failed) and imports in any state. */
export function VehicleModels(){
 const {t}=useL(),data=useLoad(modelApi.list,[],10000),imports=useLoad(vehicleCatalog.imports,[],10000);const [search,setSearch]=useState(""),[filter,setFilter]=useState<Filter>("ALL");
 const q=(s:string)=>s.toLowerCase().includes(search.toLowerCase());
 const open=(imports.data??[]).filter(r=>r.status!=="PUBLISHED"),openImports=open.filter(r=>q(`${r.make} ${r.model} ${r.code}`));
 const filters:[Filter,string][]=[["ALL",t("All","الكل")],...(["PUBLISHED","HIDDEN","IN_REVIEW","FAILED"] as const).map(f=>[f,t(STATUS[f].en,STATUS[f].ar)] as [Filter,string]),["IMPORTS",`${t("Imports","الاستيرادات")} (${open.length})`]];
 return <DeptPage back onRefresh={()=>void (data.reload(),imports.reload())}><DeptSection title={t("Vehicle 3D Models","نماذج السيارات ثلاثية الأبعاد")} caption={t("Every car with 3D: catalog models and imports in any state.","كل سيارة لها نموذج ثلاثي الأبعاد: نماذج الكتالوج والاستيرادات بأي حالة.")}/><View style={{gap:12}}>
 <GButton label={t("Add 3D model","إضافة نموذج")} onPress={()=>go("/dept/3d/add")}/>
 <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{filters.map(([f,label])=><GButton key={f} variant={filter===f?"primary":"secondary"} label={label} onPress={()=>setFilter(f)}/>)}</View>
 <Entry label={t("Search make, model or generation","البحث عن الشركة أو الطراز أو الجيل")} value={search} onChange={setSearch}/>
 {data.error?<Note tone="danger">{threeDError({message:data.error},t)}</Note>:null}{imports.error?<Note tone="danger">{threeDError({message:imports.error},t)}</Note>:null}
 {filter==="ALL"||filter==="IMPORTS"?openImports.map(r=>{const c=IMPORT_CHIP(r.status);return <ItemRow key={r.id} title={`${r.make} ${r.model} · ${r.code}`} subtitle={t(c.en,c.ar)} onPress={()=>go(`/dept/vehicles/imports/${r.id}`)} actions={importActions(t,r,()=>imports.reload())}><GText>{`${r.make} ${r.model} · ${r.code}`}</GText><Pill tone={c.tone} label={t(c.en,c.ar)}/><GText soft>{`${t("Import","استيراد")} · ${r.source} · ${new Date(r.createdAt).toLocaleDateString()}`}</GText>{r.failureReason?<GText soft>{r.failureReason}</GText>:null}</ItemRow>;}):null}
 {filter==="IMPORTS"&&imports.data&&!openImports.length?<GText soft>{t("No open imports.","لا توجد استيرادات مفتوحة.")}</GText>:null}
 {filter!=="IMPORTS"?data.data?.filter(m=>(filter==="ALL"||m.status===filter)&&q(`${m.make} ${m.model} ${m.code}`)).map(m=><ItemRow key={m.key} title={`${m.make} ${m.model} · ${m.code}`} subtitle={t(STATUS[m.status].en,STATUS[m.status].ar)} onPress={()=>go(`/dept/3d/vehicles/${m.key}`)} actions={modelActions(t,m,()=>data.reload())}><GText>{`${m.make} ${m.model} · ${m.code}`}</GText><StatusChip s={m.status}/><GText soft>{`${m.yearFrom}–${m.yearTo} · ${t("Revision","الإصدار")} ${m.revision}`}</GText><GText soft>{`${m.source} · ${m.bytes===null?t("Asset missing","الملف مفقود"):(m.bytes/1048576).toFixed(2)+" MiB"} · ${m.partMapStatus}`}</GText>{m.current?<LimitNote limits={m.limits??{}} generationId={m.generationId} action={false}/>:null}</ItemRow>):null}
 </View></DeptPage>;
}
export function VehicleModelDetail(){const {key,preview,edit}=useLocalSearchParams<{key:string;preview?:string;edit?:string}>(),{t}=useL(),data=useLoad(()=>modelApi.get(key),[key]);return <DeptPage back onRefresh={()=>void data.reload()}><DeptSection title={t("Vehicle 3D model","نموذج سيارة ثلاثي الأبعاد")}/>{data.error?<Note tone="danger">{threeDError({message:data.error},t)}</Note>:data.data?<ModelBody key={`${key}-${data.data.revision}`} m={data.data} reload={data.reload} startPreview={preview==="1"} startEdit={edit==="1"}/>:<GText>{t("Loading…","جارٍ التحميل…")}</GText>}</DeptPage>;}
function ModelBody({m,reload,startPreview=false,startEdit=false}:{m:Managed3DModel;reload:()=>Promise<unknown>;startPreview?:boolean;startEdit?:boolean}){
 const {t}=useL(),{g}=useGarageTheme();const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[show,setShow]=useState(startPreview),[reviewed,setReviewed]=useState(false);
 const [fields,setFields]=useState<Record<string,string>>(()=>Object.fromEntries(["lengthM","preRotateX","rotateY","groundOffset","centerX"].map(k=>[k,String((m.viewerConfig as unknown as Record<string,unknown>)[k]??0)])));
 const [paint,setPaint]=useState(m.viewerConfig.paintMaterials.join(", ")),[nodes,setNodes]=useState(m.viewerConfig.paintNodes.join(", ")),[keep,setKeep]=useState(!!m.viewerConfig.keepBox),[keepValues,setKeepValues]=useState([...(m.viewerConfig.keepBox?.y??[0,1]),...(m.viewerConfig.keepBox?.z??[0,1])].map(String)),[baked,setBaked]=useState(!!m.viewerConfig.bakedPaint),[bakedValues,setBakedValues]=useState([...(m.viewerConfig.bakedPaint?.hue??[0,360]),m.viewerConfig.bakedPaint?.sat??.2,m.viewerConfig.bakedPaint?.ref??.5].map(String));
 const work=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError(null);try{await fn();await refreshRuntimeModels();await reload();}catch(e){setError(threeDError(e,t));}finally{setBusy(false);}};
 return <View style={{gap:14}}><Card><GText>{`${m.make} ${m.model} ${m.code} · ${m.yearFrom}–${m.yearTo}`}</GText><StatusChip s={m.status}/><GText>{`${t("Revision","الإصدار")}: ${m.revision} · ${m.bytes===null?"—":(m.bytes/1048576).toFixed(2)+" MiB"}`}</GText><GText>{`${t("Source","المصدر")}: ${m.source}`}</GText><GText soft>{`${t("Created","أُنشئ")}: ${new Date(m.createdAt).toLocaleDateString()} · ${t("Updated","حُدّث")}: ${new Date(m.updatedAt).toLocaleDateString()}`}</GText><GText>{`${t("Part map","خريطة القطع")}: ${m.partMapStatus} · ${t("Paint","الطلاء")}: ${m.paintSupport?t("Supported","مدعوم"):t("Original finish","اللون الأصلي")}`}</GText><GText selectable>{m.sha256}</GText></Card>
 <EditDetails m={m} busy={busy} work={work} startOpen={startEdit}/>{m.current?<LimitNote limits={m.limits??{}} generationId={m.generationId}/>:null}
 <GButton variant="secondary" label={t("Preview model","معاينة النموذج")} onPress={()=>setShow(!show)}/>{show&&m.bytes!==null?<Car3DView model={m.viewerConfig} assetLoader={()=>modelApi.asset(m.key)} interactive color="#c62828" bg={g.cardSoft} style={{height:310}}/>:null}
 <Card><GText>{t("Provenance and rights","المصدر والحقوق")}</GText><GText>{m.provenance.title}</GText><GText>{`${m.provenance.author} · ${m.provenance.license}`}</GText><GText selectable>{m.provenance.url}</GText>{m.provenance.licenseUrl?<GText selectable>{m.provenance.licenseUrl}</GText>:null}<GateSummary gate={m.qualityGate}/>{m.importId?<GButton variant="secondary" label={t("View source validation","عرض التحقق من المصدر")} onPress={()=>go(`/dept/vehicles/imports/${m.importId}`)}/>:null}</Card>
 <Card><GText>{t("Viewer configuration","إعدادات العارض")}</GText>{Object.entries(fields).map(([k,v])=><Entry key={k} label={k} numeric value={v} onChange={s=>setFields(f=>({...f,[k]:s}))}/>)}<Entry label={t("Paint materials (comma separated)","خامات الطلاء (مفصولة بفواصل)")} value={paint} onChange={setPaint}/><Entry label={t("Paint nodes (comma separated)","عناصر الطلاء (مفصولة بفواصل)")} value={nodes} onChange={setNodes}/><Confirm label={t("Keep box enabled","تفعيل منطقة إبقاء الهيكل")} value={keep} onChange={setKeep}/>{keep?keepValues.map((v,i)=><Entry key={i} label={["Y min","Y max","Z min","Z max"][i]} numeric value={v} onChange={s=>setKeepValues(a=>a.map((x,j)=>j===i?s:x))}/>):null}<Confirm label={t("Baked paint enabled","تفعيل تلوين الخامة المدمجة")} value={baked} onChange={setBaked}/>{baked?bakedValues.map((v,i)=><Entry key={i} label={["Hue min","Hue max","Saturation","Reference"][i]} numeric value={v} onChange={s=>setBakedValues(a=>a.map((x,j)=>j===i?s:x))}/>):null}<Note>{t("Shape changes hide this car from customers until you preview and approve it again. Part maps and fits need renewed review.","تُخفي تغييرات الشكل هذه السيارة عن العملاء إلى أن تعاينها وتعتمدها مجددًا. تحتاج خريطة القطع والتركيبات إلى مراجعة جديدة.")}</Note><GButton label={t("Validate and save configuration","التحقق وحفظ الإعدادات")} disabled={busy||!m.current} onPress={()=>void work(()=>modelApi.configure(m.key,m.revision,{...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,Number(v)])),paintMaterials:paint.split(",").map(s=>s.trim()).filter(Boolean),paintNodes:nodes.split(",").map(s=>s.trim()).filter(Boolean),keepBox:keep?{y:keepValues.slice(0,2).map(Number),z:keepValues.slice(2).map(Number)}:null,bakedPaint:baked?{hue:bakedValues.slice(0,2).map(Number),sat:Number(bakedValues[2]),ref:Number(bakedValues[3])}:null}))}/></Card>
 <GButton variant="secondary" label={t("Edit / confirm part map","تعديل / تأكيد خريطة القطع")} onPress={()=>go(`/dept/accessory-zones?key=${m.key}&mode=parts`)}/><GButton variant="secondary" label={t("Accessory zones and offsets","مناطق القطع وإزاحاتها")} onPress={()=>go(`/dept/accessory-zones?key=${m.key}&mode=zones`)}/><GButton variant="secondary" label={t("Replace model","استبدال النموذج")} onPress={()=>go(`/dept/3d/add?generationId=${m.generationId}`)}/><View>{m.reviewRequired?<Confirm label={t("I previewed and approve the changed geometry","عاينتُ الشكل المعدّل وأوافق عليه")} value={reviewed} onChange={v=>{if(show)setReviewed(v);}}/>:null}</View><GButton variant={m.published?"danger":"secondary"} label={m.published?t("Hide from customers","إخفاء عن العملاء"):t("Show to customers","إظهار للعملاء")} disabled={busy||!m.current||!!m.reviewRequired&&!reviewed} onPress={()=>void work(()=>modelApi.publication(m.key,m.revision,!m.published,reviewed))}/>
 <DeleteModel m={m}/><GenerationUsage id={m.generationId} isActive onDone={()=>router.replace("/dept/3d/vehicles" as Href)}/>{error?<Note tone="danger">{error}</Note>:null}</View>;
}

/** One form for the car's details: names EN/AR, aliases (shared by the whole make), production years, body type. */
function EditDetails({m,busy,work,startOpen=false}:{m:Managed3DModel;busy:boolean;work:(fn:()=>Promise<unknown>)=>Promise<void>;startOpen?:boolean}){
 const {t}=useL();const [open,setOpen]=useState(startOpen),[nameEn,setNameEn]=useState(m.nameEn),[nameAr,setNameAr]=useState(m.nameAr),[aliases,setAliases]=useState(m.aliases.join(", ")),[from,setFrom]=useState(String(m.yearFrom)),[to,setTo]=useState(String(m.yearTo)),[body,setBody]=useState(m.bodyType??"");
 const list=aliases.split(",").map(x=>x.trim()).filter(Boolean),aliasChanged=list.join("|")!==m.aliases.join("|");
 return <Card><GButton variant="secondary" label={t("Edit details","تعديل التفاصيل")} onPress={()=>setOpen(!open)}/>{open?<View style={{gap:10}}>
  <Entry label={t("Name (English)","الاسم (إنجليزي)")} value={nameEn} onChange={setNameEn}/><Entry label={t("Name (Arabic)","الاسم (عربي)")} value={nameAr} onChange={setNameAr}/>
  <Entry label={t("Make aliases, comma separated (shared by every model of this make)","أسماء بديلة للشركة، مفصولة بفواصل (مشتركة بين كل طرازاتها)")} value={aliases} onChange={setAliases} editable={!!m.brandId}/>
  <Entry label={t("Production year from","سنة الإنتاج من")} numeric value={from} onChange={setFrom}/><Entry label={t("Production year to","سنة الإنتاج إلى")} numeric value={to} onChange={setTo}/>
  <GText>{t("Body type","نوع الهيكل")}</GText><View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{BODY_TYPES.map(([id,en,ar])=><GButton key={id} variant={body===id?"primary":"secondary"} label={t(en,ar)} onPress={()=>setBody(id)}/>)}</View>
  <GButton label={t("Save details","حفظ التفاصيل")} disabled={busy||!nameEn.trim()||!nameAr.trim()} onPress={()=>void work(async()=>{await vehicleCatalog.save("generations",m.generationId,{nameEn:nameEn.trim(),nameAr:nameAr.trim(),yearFrom:Number(from),yearTo:Number(to),bodyType:body||null});if(aliasChanged&&m.brandId)try{await vehicleCatalog.save("brands",m.brandId,{aliases:list});}catch{throw new Error(t("Details saved, but aliases failed — try again","تم حفظ التفاصيل، لكن فشل حفظ الأسماء البديلة — حاول مرة أخرى"));}})}/>
 </View>:null}</Card>;
}

/** Add 3D model: pick the source. Both paths end in the same private review (validation, part map, preview) and an explicit Approve. */
export function AddModel(){
 const {generationId}=useLocalSearchParams<{generationId?:string}>(),{t}=useL(),tax=useLoad(vehicleCatalog.list,[]);const [mode,setMode]=useState<"link"|"file">("link");
 return <DeptPage back><DeptSection title={t("Add 3D model","إضافة نموذج ثلاثي الأبعاد")} caption={t("Source → validation → private part-map review → preview → Approve. Customers see nothing until you approve.","المصدر ← التحقق ← مراجعة خريطة القطع بشكل خاص ← المعاينة ← الاعتماد. لا يرى العملاء شيئًا قبل اعتمادك.")}/><View style={{gap:12}}>
  <View style={{flexDirection:"row",gap:8}}><View style={{flex:1}}><GButton variant={mode==="link"?"primary":"secondary"} label={t("Sketchfab link","رابط Sketchfab")} onPress={()=>setMode("link")}/></View><View style={{flex:1}}><GButton variant={mode==="file"?"primary":"secondary"} label={t("Upload GLB","رفع GLB")} onPress={()=>setMode("file")}/></View></View>
  {mode==="link"?<>{generationId?<Note>{t("Replacing: customers keep the current model until you approve the new one. The current model stays in the revision history.","الاستبدال: يبقى النموذج الحالي ظاهرًا للعملاء إلى أن تعتمد الجديد، ويبقى في سجل الإصدارات.")}</Note>:null}<Note>{t("The link is inspected first (license, downloadable). Nothing is downloaded until you tap Import.","يُفحص الرابط أولًا (الترخيص وإمكانية التنزيل). لا يُنزَّل شيء قبل الضغط على استيراد.")}</Note><GButton label={t("Continue with a link","المتابعة برابط")} onPress={()=>go(generationId?`/dept/vehicles/imports/new?generationId=${generationId}`:"/dept/vehicles/imports/new")}/></>
   :tax.data?<UploadModel taxonomy={tax.data} initialGeneration={generationId} done={id=>go(`/dept/vehicles/imports/${id}`)}/>:tax.error?<Note tone="danger">{threeDError({message:tax.error},t)}</Note>:<GText>{t("Loading…","جارٍ التحميل…")}</GText>}
 </View></DeptPage>;
}


/** Delete 3D model: permanent (GLB file, part map, zones, this car's accessory fits, its import). Shows what is affected, then asks to confirm. */
function DeleteModel({m}:{m:Managed3DModel}){
 const {t}=useL();const [impact,setImpact]=useState<DeleteImpact|null>(null),[sure,setSure]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError(null);try{await fn();}catch(e){setError(threeDError(e,t));}finally{setBusy(false);}};
 const rows:[keyof DeleteImpact,string,string][]=[["garageCars","Customer Garage cars of this generation lose the 3D view","سيارات العملاء من هذا الجيل تفقد العرض ثلاثي الأبعاد"],["shopAccessories","Shop accessories for this car can no longer be shown on it","إكسسوارات المتاجر لهذه السيارة لن تظهر عليها"],["accessoryFits","Accessory fits deleted","تركيبات إكسسوارات تُحذف"],["partMaps","Part map deleted","خريطة القطع تُحذف"],["zones","Accessory zones deleted","مناطق الإكسسوارات تُحذف"],["imports","Import record deleted","سجل الاستيراد يُحذف"]];
 return <Card><GText>{t("Delete 3D model","حذف النموذج ثلاثي الأبعاد")}</GText>
  {!impact?<GButton variant="danger" label={t("Delete 3D model…","حذف النموذج ثلاثي الأبعاد…")} disabled={busy} onPress={()=>void run(async()=>setImpact(await modelApi.deleteImpact(m.key)))}/>:<>
   <Note tone="warning">{impact.published?t("Customers see this model now. It disappears for them immediately.","يرى العملاء هذا النموذج الآن، وسيختفي عنهم فورًا."):t("This model is not shown to customers.","هذا النموذج غير ظاهر للعملاء.")}</Note>
   {rows.filter(([k])=>Number(impact[k])>0).map(([k,en,ar])=><GText key={k}>{`• ${t(en,ar)}: ${impact[k]}`}</GText>)}
   <GText soft>{t("The GLB file and these records are deleted permanently. This cannot be undone.","يُحذف ملف GLB وهذه السجلات نهائيًا ولا يمكن التراجع.")}</GText>
   <Confirm label={t("I understand and want to delete this 3D model permanently","أفهم ذلك وأريد حذف هذا النموذج نهائيًا")} value={sure} onChange={setSure}/>
   <GButton variant="danger" label={t("Delete permanently","حذف نهائي")} disabled={busy||!sure} onPress={()=>void run(async()=>{await modelApi.deleteModel(m.key);await refreshRuntimeModels();router.replace("/dept/3d/vehicles" as Href);})}/>
   <GButton variant="ghost" label={t("Cancel","إلغاء")} disabled={busy} onPress={()=>{setImpact(null);setSure(false);}}/></>}
  {error?<Note tone="danger">{error}</Note>:null}</Card>;
}
