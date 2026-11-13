import {useEffect, useState, type ReactNode} from "react";
import {Pressable, View} from "react-native";
import {router, type Href} from "expo-router";
import {Card, GButton, GText, Note, Sheet} from "../../components/garage";
import {useL} from "../../core/hooks/useL";
import {gType, useGarageTheme} from "../../theme/garage";
import {Car3DView} from "../car3d/Car3DView";
import {adminAccessoryApi, type AdminAccessory} from "./api";
import {REVIEW_LABELS, REVIEW_BLOCKERS, reviewAction, reviewRoute, type ReviewTarget} from "./reviewState";

type Action = Parameters<typeof adminAccessoryApi.act>[1];
export function AccessoryFinalReview({a, busy, act, children}: {a: AdminAccessory; busy: boolean; act: (action: Action, body?: Record<string,unknown>)=>Promise<unknown>; children?: ReactNode}) {
  const {t,isArabic}=useL(), {g,align,row}=useGarageTheme();
  const [verified,setVerified]=useState(false), [confirm,setConfirm]=useState(false), [showModel,setShowModel]=useState(false);
  const review=a.review;
  const fingerprint=JSON.stringify([a.modelRevision,a.preview,review?.publication.canPublish]);
  useEffect(()=>{setVerified(false);setConfirm(false);},[fingerprint]);
  const label=(value:string)=>REVIEW_LABELS[value]?t(...REVIEW_LABELS[value]):value;
  const open=(target:ReviewTarget,mode:"parts"|"fits")=>router.push(reviewRoute(a.id,target,mode) as Href);
  const status=(name:string,value:string)=><View style={[row,{justifyContent:"space-between",flexWrap:"wrap",gap:8}]}><GText soft style={align}>{name}</GText><GText style={[align,{flexShrink:1}]}>{value}</GText></View>;
  if(!review)return <Card><Note tone="warning">{t("Review status could not be loaded. Refresh before publishing.","تعذّر تحميل حالة المراجعة. حدّث الصفحة قبل النشر.")}</Note></Card>;
  const published=a.status==="PUBLISHED", ready=review.publication.canPublish;
  const none={x:0,y:0,z:0,scale:1};
  return <View style={{gap:14}} testID="accessory-final-review">
    <Card><GText style={[gType.title,align]}>{t("3D final review","المراجعة النهائية للنموذج")}</GText><View style={{gap:10,marginTop:12}}>
      <GText style={[gType.label,align]}>{t("Model","النموذج")}</GText>
      {status(t("Generated","مُنشأ"),review.model.generated?t("Yes","نعم"):t("Not complete","غير مكتمل"))}
      {status(t("Optimized","مُحسّن"),review.model.keptOriginal?t("Not needed: original kept (under 8 MB)","غير مطلوب: أُبقي الملف الأصلي (أقل من 8 ميغابايت)"):review.model.optimized?t("Yes","نعم"):t("Not complete","غير مكتمل"))}
      {status(t("Model validation","التحقق من النموذج"),label(review.model.validation))}
      {review.model.validation!=="PASSED"&&review.model.reason?<Note tone="warning">{review.model.reason}</Note>:null}
      {review.canRetryProcessing?<GButton label={t("Retry processing","إعادة معالجة النموذج")} disabled={busy} onPress={()=>void act("start",{retryProcessing:true})}/>:null}
      {review.canValidateManual?<GButton label={busy?t("Validating…","جارٍ التحقق…"):t("Run validation","تشغيل التحقق")} disabled={busy} onPress={()=>void act("validate")}/>:null}
      {status(t("Publication","النشر"),label(review.publication.state))}
      {review.model.exists?<GButton variant="secondary" label={published?t("View published model","عرض النموذج المنشور"):t("Preview generated model","معاينة النموذج المُنشأ")} onPress={()=>setShowModel(v=>!v)}/>:null}
      {showModel?<Car3DView model={{key:review.publication.file?.replace(/\.glb$/,"")??`private-accessory-${a.id}-${a.modelRevision}`,generation:a.product?.name??"",lengthM:1.7,rotateY:0,groundOffset:0,paintNodes:[],paintMaterials:[],rimsSwappable:false,wing:none,rack:none,credit:{title:a.product?.name??"",author:"",url:"",license:published?"Published accessory":"Private review"}}} assetLoader={review.publication.file?undefined:()=>adminAccessoryApi.asset(a.id,"model")} color="#c3c7cc" bg={g.cardSoft} interactive style={{height:280}}/>:null}
    </View></Card>
    {review.targets.map(target=>{
      const action=reviewAction(review,target), name=isArabic?target.nameAr:target.name;
      const rear=target.semanticPart==="REAR_BUMPER";
      return <Card key={target.generationId}><View style={{gap:10}}>
        <GText style={[gType.label,align]}>{name}</GText>
        {status(t("Part map","خريطة القطع"),label(target.partMap))}
        {status(t("Fit","التركيب"),label(target.fit.state))}
        {!target.has3d?<Note tone="warning">{t("This vehicle has no published 3D model.","لا يوجد نموذج سيارة منشور لهذا الجيل.")}</Note>:null}
        {target.partMap==="MISSING"||target.partMap==="STALE"?<Note tone="warning">{rear?t("Rear bumper stock-part mapping is not confirmed for this vehicle.","خريطة قطع الصدام الخلفي الأصلي غير مؤكدة لهذه السيارة."):t("Front bumper stock-part mapping is not confirmed for this vehicle.","خريطة قطع الصدام الأمامي الأصلي غير مؤكدة لهذه السيارة.")}</Note>:null}
        {target.fit.reason?<Note tone="warning">{target.fit.reason}</Note>:null}
        {action==="partMap"?<GButton label={t("Open part map","فتح خريطة القطع")} disabled={busy} onPress={()=>open(target,"parts")}/>:null}
        {action==="runFit"?<GButton label={t("Run automatic fit","تشغيل التركيب التلقائي")} disabled={busy} onPress={()=>void act("refit")}/>:null}
        {action==="corrections"?<GButton label={t("Open fit corrections","فتح تصحيحات التركيب")} disabled={busy} onPress={()=>open(target,"fits")}/>:null}
        {action==="reviewFit"?<GButton label={t("Review fit","مراجعة التركيب")} disabled={busy} onPress={()=>open(target,"fits")}/>:null}
        {action==="preview"?<GButton label={t("Render final preview","عرض المعاينة النهائية")} disabled={busy} onPress={()=>void act("preview",{generationId:target.generationId})}/>:null}
        {published&&target.fit.state==="APPROVED"&&target.has3d?<GButton variant="secondary" label={t("View on compatible car","العرض على سيارة متوافقة")} onPress={()=>open(target,"fits")}/>:null}
      </View></Card>;
    })}
    {!published?<Card><View style={{gap:12}}>
      <GText style={[gType.title,align]}>{t("Final review & publication","المراجعة النهائية والنشر")}</GText>
      {children}
      {review.publication.blockers.map((b,i)=><View key={`${b.code}-${i}`} style={{gap:4}}><Note tone="warning">{isArabic&&REVIEW_BLOCKERS[b.code]?REVIEW_BLOCKERS[b.code][1]:b.message}</Note>{isArabic?<GText selectable soft style={{textAlign:"left",writingDirection:"ltr"}}>{b.message}</GText>:null}</View>)}
      {ready?<Pressable accessibilityRole="checkbox" accessibilityState={{checked:verified}} onPress={()=>setVerified(v=>!v)} style={[row,{gap:10,alignItems:"flex-start",paddingVertical:8}]}><GText>{verified?"☑":"☐"}</GText><GText style={[align,{flex:1}]}>{t("I reviewed all six views: the real part, orientation, size and fit are correct.","راجعت المناظر الستة: القطعة الحقيقية واتجاهها وحجمها وتركيبها صحيحة.")}</GText></Pressable>:null}
      {ready&&!verified?<GText soft style={align}>{t("Confirm the six-view review to enable publication.","أكّد مراجعة المناظر الستة لتفعيل النشر.")}</GText>:null}
      {review.model.validation==="PASSED"?<GButton icon="checkmark-circle-outline" label={t("Approve & Publish 3D Model","اعتماد ونشر النموذج ثلاثي الأبعاد")} disabled={busy||!ready||!verified} onPress={()=>setConfirm(true)}/>:<GText soft style={align}>{t("Publication blocked until model validation passes.","النشر محظور حتى يجتاز النموذج التحقق.")}</GText>}
    </View></Card>:null}
    <Sheet visible={confirm} onClose={()=>setConfirm(false)} title={t("Publish this 3D model?","هل تريد نشر هذا النموذج؟")} closeLabel={t("Cancel","إلغاء")}>
      <View style={{gap:16}}><GText style={align}>{t("After publication, customers with compatible vehicles will be able to use View on my car.","بعد النشر، يستطيع العملاء ذوو السيارات المتوافقة استخدام «العرض على سيارتي».")}</GText><GButton label={t("Confirm publication","تأكيد النشر")} disabled={busy||!ready||!verified} onPress={()=>{setConfirm(false);void act("publish",{visuallyVerified:true,modelRevision:a.modelRevision});}}/><GButton variant="secondary" label={t("Cancel","إلغاء")} onPress={()=>setConfirm(false)}/></View>
    </Sheet>
  </View>;
}
