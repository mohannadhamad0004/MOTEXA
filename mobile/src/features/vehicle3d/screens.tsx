import { type Href, router, useLocalSearchParams } from "expo-router";
import { photoErrorText, pickPhoto } from "../../core/hooks/pickPhoto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";
import { Card, Chip, GarageHero, GaragePage, GButton, GText, Note } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useGarage, refreshGarage } from "../catalog/myCar";
import { Car3DView } from "../car3d/Car3DView";
import { refreshRuntimeModels } from "../car3d/runtimeModels";
import { gType, useGarageTheme } from "../../theme/garage";
import { privateAssetBase64, submissionApi, submissionModel, views, type Submission, type ViewName } from "./api";
import { Check, ModelPreview, Photo, stageLabels, statusLabels, validationArabic } from "./submission";

function SubmissionBody({ s, admin, reload }: { s: Submission; admin: boolean; reload: () => Promise<unknown> }) {
  const { t } = useL(); const { g, align } = useGarageTheme();
  const [busy,setBusy] = useState(false), [error,setError] = useState<string | null>(null);
  const [showModel,setShowModel] = useState(admin), [consent,setConsent] = useState(false), [rights,setRights] = useState(false);
  const [verified,setVerified] = useState(false), [replace,setReplace] = useState(false), [notes,setNotes] = useState("");
  const work = async (fn: () => Promise<unknown>) => {
    setBusy(true);setError(null);
    try { await fn(); await reload(); }
    catch (e) { const message = (e as Error).message; setError(t(message || "Request failed. Try again.", validationArabic[message] ?? "تعذّر إكمال الطلب. تحقق من الصور والصلاحيات وأعد المحاولة.")); }
    finally { setBusy(false); }
  };
  const pick = async (view: ViewName) => {
    let photo;
    try { photo = await pickPhoto(); } catch (e) { setError(photoErrorText(e, t)); return; } // resized + converted to JPEG, size checked
    if (photo) await work(async () => { await submissionApi.photo(s.id, view, photo.base64); });
  };
  const field = { borderWidth: 1, borderColor: g.line, borderRadius: 12, color: g.ink, padding: 12, minHeight: 48, textAlign: align.textAlign, backgroundColor: g.cardSoft } as const;
  return <View style={{ gap: 14 }}>
    <Card>
      <GText style={[gType.title,align]}>{`${s.make} ${s.model} · ${s.year}`}</GText>
      <GText soft style={align}>{s.generationName || t("Generation not selected", "لم يتم تحديد الجيل")}</GText>
      <GText selectable soft style={[gType.caption,align]}>{s.id}</GText>
      <GText style={[gType.label,align,{ marginTop: 12 }]}>{t(statusLabels[s.status][0],statusLabels[s.status][1])}</GText>
      {s.status==="DRAFT"&&views.every(v=>s.photos[v])?<GText style={align}>{t("Ready to generate","جاهز لإنشاء النموذج")}</GText>:null}
      {s.status==="PROCESSING"?<GText style={align}>{t(...(stageLabels[s.generationStage]??stageLabels.GENERATING))}{s.providerProgress!==null&&s.providerProgress!==undefined&&s.generationStage==="GENERATING"?` · ${s.providerProgress}%`:""}</GText>:null}
      {admin?<GText soft style={align}>{`${t("Provider","مزود الإنشاء")}: ${s.provider==="MESHY"?"Meshy":s.provider==="MOCK"?t("Demo / mock","تجريبي"):"—"}`}</GText>:null}
      {s.submittedAt ? <GText soft style={align}>{`${t("Submitted", "تاريخ الإرسال")}: ${new Date(s.submittedAt).toLocaleDateString()}`}</GText> : null}
      {s.reviewNotes ? <Note>{s.reviewNotes}</Note> : null}
      {s.status === "FAILED" ? <Note tone="danger">{t(s.failureReason ?? "Generation failed. Try clearer photos.", "تعذّر إنشاء النموذج. جرّب صورًا أوضح ثم أعد المحاولة.")}</Note> : null}
      {s.generationMode === "mock" ? <Note>{t("Mock mode: this generic preview tests the workflow. It is not a reconstruction of your car and cannot enter the catalog.", "الوضع التجريبي: نموذج عام لاختبار الخطوات، وليس إعادة بناء لسيارتك، ولا يمكن إضافته للكتالوج.")}</Note> : null}
      {admin && s.validation ? <Note>{s.validation.valid ? t("Generation passed technical validation. Visual verification is still required; approval repeats the checks.", "اجتاز النموذج فحوص الإنشاء التقنية. ما زالت المراجعة البصرية مطلوبة، وتُعاد الفحوص عند الموافقة.") : t("Technical validation has not passed.", "لم يجتز النموذج التحقق التقني.")}</Note> : null}
      {admin&&s.validation?<GText soft style={align}>{`${t("File size","حجم الملف")}: ${typeof s.validation.bytes==="number"?(s.validation.bytes/1048576).toFixed(2)+" MB":"—"}\n${t("Dimensions / metres","الأبعاد / متر")}: ${Array.isArray(s.validation.dimensions)?s.validation.dimensions.map(n=>Number(n).toFixed(2)).join(" × "):"—"}`}</GText>:null}
      {s.generationErrorCode?<GText soft selectable style={align}>{s.generationErrorCode}</GText>:null}
    </Card>
    <Note>{t("Use four clear photos of the same car: front, rear, left and right. Show the whole vehicle, keep the camera level, and avoid people and personal documents. Photos remain private.", "استخدم أربع صور واضحة للسيارة نفسها: أمام وخلف ويسار ويمين. أظهر السيارة كاملة وأبقِ الكاميرا مستقيمة وتجنّب الأشخاص والوثائق الشخصية. تبقى الصور خاصة.")}</Note>
    {views.map(view => <Card key={`${view}:${s.photoRevision}`}>
      <Photo s={s} view={view} admin={admin} />
      {!admin && ["DRAFT","FAILED"].includes(s.status) ? <GButton style={{ marginTop: 10 }} variant="secondary" label={s.photos[view] ? t("Replace photo", "استبدال الصورة") : t("Choose photo", "اختيار صورة")} disabled={busy} onPress={() => void pick(view)} /> : null}
    </Card>)}
    {s.hasModel ? <>
      <GButton variant="secondary" label={showModel ? t("Hide 3D preview", "إخفاء العرض ثلاثي الأبعاد") : t("View my 3D car", "عرض سيارتي ثلاثية الأبعاد")} onPress={() => setShowModel(v => !v)} />
      {showModel ? <ModelPreview key={s.modelRevision} s={s} admin={admin} /> : null}
    </> : null}
    {!admin && ["DRAFT","FAILED"].includes(s.status) ? <>
      <Check checked={consent} label={t("I own these photos and permit Meshy processing and catalog sharing of the approved 3D representation. My original photos remain private.", "أملك هذه الصور وأسمح بمعالجتها عبر Meshy ومشاركة النموذج المعتمد في الكتالوج. تبقى صوري الأصلية خاصة.")} onPress={() => setConsent(v => !v)} disabled={busy} />
      <GButton label={t("Request Parts Admin review", "طلب مراجعة إدارة قطع الغيار")} disabled={busy || !consent || views.some(v => !s.photos[v])} onPress={() => void work(async() => {const result=await submissionApi.generate(s.id);router.replace(`/customer/vehicle-requests/${result.submission.id}` as Href);})} />
    </> : null}
    {!admin && s.status === "READY" && s.generationMode !== "mock" ? <>
      <Check checked={rights} label={t("I have the rights to share this 3D representation. If approved, MOTEXA may make it available to other users. My original photos remain private.", "أملك حقوق مشاركة هذا التمثيل ثلاثي الأبعاد. عند اعتماده، قد تتيحه موتكسا للمستخدمين الآخرين. تبقى صوري الأصلية خاصة.")} disabled={busy} onPress={() => setRights(v => !v)} />
      <GButton label={t("Submit to MOTEXA catalog", "إرسال إلى كتالوج موتكسا")} disabled={busy || !rights || !s.generationId} onPress={() => void work(() => submissionApi.submit(s.id))} />
      {!s.generationId ? <Note>{t("A specific generation is needed for catalog review. Update your Garage car and create another submission.", "تتطلب مراجعة الكتالوج جيلًا محددًا. عدّل سيارة الكراج وأنشئ طلبًا جديدًا.")}</Note> : null}
    </> : null}
    {admin&&s.status!=="APPROVED"&&(s.hasModel||s.hasRawModel)?<Card>
      <GButton variant="secondary" label={t("Validate again","إعادة التحقق")} disabled={busy} onPress={()=>void work(async()=>{setVerified(false);await submissionApi.validate(s.id);})}/>
      <GText soft style={[align,{marginTop:8}]}>{t("Orientation is a visual check. Use these corrections only after inspecting the source photos and model.","اتجاه النموذج يحتاج مراجعة بصرية. استخدم التصحيحات بعد فحص الصور والنموذج فقط.")}</GText>
      <GButton variant="secondary" style={{marginTop:8}} label={t("Turn front by 180°","تدوير المقدمة ١٨٠ درجة")} disabled={busy} onPress={()=>void work(async()=>{setVerified(false);await submissionApi.validate(s.id,{...s.preparationConfig,rotateY:Math.abs(s.preparationConfig?.rotateY??0)<.01?Math.PI:0});})}/>
      <GButton variant="secondary" style={{marginTop:8}} label={t("Correct source up-axis −90°","تصحيح المحور الرأسي −٩٠ درجة")} disabled={busy} onPress={()=>void work(async()=>{setVerified(false);await submissionApi.validate(s.id,{...s.preparationConfig,preRotateX:-Math.PI/2});})}/>
    </Card>:null}
    {admin && s.status === "SUBMITTED" ? <Card>
      <GText style={gType.label}>{t("Review notes", "ملاحظات المراجعة")}</GText>
      <TextInput accessibilityLabel={t("Review notes", "ملاحظات المراجعة")} multiline value={notes} onChangeText={setNotes} maxLength={2000} style={[field,{ minHeight: 100, marginTop: 8 }]} placeholderTextColor={g.soft} />
      <Note>{t("Meshy provenance and customer permission are recorded privately. Customer identity and provider task IDs are excluded from the shared catalog.","يُحفظ مصدر Meshy وإذن العميل بشكل خاص. لا تظهر هوية العميل ومعرف المهمة في الكتالوج المشترك.")}</Note>
      <Check checked={verified} label={t("I verified brand, model, generation/body, approximate year, orientation, geometry, wheels, grounding, no unrelated scenery, visual quality and source rights.", "تحققت من الشركة والطراز والجيل والهيكل والسنة التقريبية والاتجاه والهندسة والعجلات والأرضية وعدم وجود مشاهد غريبة والجودة البصرية وحقوق المصدر.")} disabled={busy || !showModel} onPress={() => setVerified(v => !v)} />
      {s.existingModel3dKey ? <>
        <Note>{t("This generation already has a shared model. Approval requires explicit replacement.", "يوجد نموذج مشترك لهذا الجيل. تتطلب الموافقة استبداله صراحةً.")}</Note>
        <Check checked={replace} label={t("Replace existing model", "استبدال النموذج الحالي")} disabled={busy} onPress={() => setReplace(v => !v)} />
      </> : null}
      <GButton style={{ marginTop: 12 }} label={t("Validate and approve", "التحقق والموافقة")} disabled={busy || !verified || s.provider!=="MESHY" || (!!s.existingModel3dKey && !replace)} onPress={() => void work(async () => {
        await submissionApi.review(s.id,"approve",{ notes, visuallyVerified: verified, modelRevision:s.modelRevision, ...(replace ? { replaceExistingKey: s.existingModel3dKey } : {}) });
        await refreshRuntimeModels();
      })} />
      <GButton style={{ marginTop: 10 }} variant="danger" label={t("Reject", "رفض")} disabled={busy || !notes.trim()} onPress={() => void work(() => submissionApi.review(s.id,"reject",{ notes }))} />
      <GButton style={{marginTop:10}} variant="secondary" label={t("Request regeneration","طلب إعادة الإنشاء")} disabled={busy||!notes.trim()} onPress={()=>void work(()=>submissionApi.requestRegeneration(s.id,notes))}/>
    </Card> : null}
    {!admin&&["READY","REJECTED"].includes(s.status)?<GButton variant="secondary" label={t("Regenerate / replace photos","إعادة الإنشاء / استبدال الصور")} disabled={busy} onPress={()=>void work(()=>submissionApi.regenerate(s.id))}/>:null}
    {!admin && s.status !== "APPROVED" ? <GButton variant="danger" label={t("Cancel and delete submission", "إلغاء الطلب وحذفه")} disabled={busy} onPress={() => void work(() => submissionApi.remove(s.id))} /> : null}
    {busy ? <GText soft>{t("Working…", "جارٍ التنفيذ…")}</GText> : null}
    {error ? <Note tone="danger">{error}</Note> : null}
  </View>;
}
export function CustomerVehicle3DScreen() {
  const { carId } = useLocalSearchParams<{carId: string}>(); const { garageCars } = useGarage();
  const { t } = useL(); const [busy,setBusy] = useState(false), [error,setError] = useState(false);
  const [selected,setSelected] = useState<string | null>(null);
  const list = useLoad(() => submissionApi.list(), [carId],5000);
  const car = garageCars.find(c => c.id === carId);
  const submissions = (list.data ?? []).filter(s => s.garageCarId === carId);
  const current = submissions.find(s => s.id === selected) ?? submissions[0];
  useEffect(() => {
    if (current?.approvedModel3dKey) { void refreshGarage(); void refreshRuntimeModels(); }
  }, [current?.approvedModel3dKey]);
  return <GaragePage hero={<GarageHero variant="detail" backLabel={t("Back", "رجوع")} onBack={() => router.back()} title={t("My private 3D car", "سيارتي ثلاثية الأبعاد الخاصة")} line={car ? `${car.make} ${car.model} ${car.year}` : ""} />} onRefresh={() => void list.reload()} refreshing={list.loading && !!list.data}>
    <View style={{ gap: 14 }}>
      {list.error || error ? <Note tone="danger">{t("Could not load submissions. Refresh to retry.", "تعذّر تحميل الطلبات. حدّث للمحاولة.")}</Note> : null}
      {!list.data ? <GText>{t("Loading…", "جارٍ التحميل…")}</GText> : null}
      {current ? <SubmissionBody key={JSON.stringify([current.id,current.modelRevision,current.existingModel3dKey])} s={current} admin={false} reload={list.reload} /> : null}
      {car && list.data && !list.error && (!current || ["REJECTED","APPROVED"].includes(current.status)) ? <GButton label={current ? t("Create another submission", "إنشاء طلب آخر") : t("Create my 3D car", "إنشاء سيارتي ثلاثية الأبعاد")} disabled={busy} onPress={() => {
        setBusy(true);setError(false);void submissionApi.create(carId).then(s => { setSelected(s.id); return list.reload(); }).catch(() => setError(true)).finally(() => setBusy(false));
      }} /> : null}
      {submissions.filter(s => s.id !== current?.id).map(s => <Card key={s.id}><GText>{`${s.make} ${s.model} ${s.year}`}</GText><GText>{t(statusLabels[s.status][0],statusLabels[s.status][1])}</GText>{s.reviewNotes ? <GText soft>{s.reviewNotes}</GText> : null}<GButton variant="secondary" label={t("Open submission", "فتح الطلب")} onPress={() => setSelected(s.id)} /></Card>)}
    </View>
  </GaragePage>;
}
