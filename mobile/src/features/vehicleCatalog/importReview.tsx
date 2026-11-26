// One vehicle 3D import (/dept/vehicles/imports/:id, Sketchfab or an uploaded GLB) on the Detail template: progress and the saved
// failure reason, source and rights, the 3D check (original vs red paint), the settings to validate again, the part-map proposal.
// ONE primary at the bottom: "Approve and publish to customers" (enabled after validation + the visual check; the server repeats it).
// Retry, the private part-map review and Discard are in ⋮.
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { Field, GButton, GText, Note, StatusChip, Toggle } from "../../components/garage";
import { Block, Facts, Page } from "../../components/manage/Page";
import { type ItemAction } from "../../components/ItemActionsMenu";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../theme/garage";
import { type ModelGate } from "../accessory3d/api";
import { GateSummary } from "../accessory3d/gate";
import { Car3DView } from "../car3d/Car3DView";
import type { CarModel } from "../car3d/models";
import { refreshRuntimeModels } from "../car3d/runtimeModels";
import { catalogService } from "../catalog/catalogService";
import { importPath, vehicleCatalog, type ModelImport } from "./api";
import { IMPORT_ERROR_LABELS, IMPORT_LABELS, failureText, importError, runningImport, simplifiedText } from "./importState";
import { authenticatedBase64 } from "../vehicle3d/api";

const go = (path: string) => router.push(path as Href);

export function SketchfabImportReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const loaded = useLoad(() => vehicleCatalog.getImport(id), [id], 2500);
  const r = loaded.data;
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [discarding, setDiscarding] = useState(false);
  const work = async (fn: () => Promise<unknown>) => { setBusy(true); setError(null); try { await fn(); await loaded.reload(); catalogService.invalidateVehicleList(); await refreshRuntimeModels(); } catch (e) { setError(importError(e, t)); } finally { setBusy(false); } };
  if (!r) return <Page title={t("Vehicle import review", "مراجعة استيراد المركبة")}>{loaded.error ? <Note tone="danger">{t("Could not load this import. Parts Admin access is required.", "تعذّر تحميل هذا الاستيراد. يلزم صلاحية إدارة قطع الغيار.")}</Note> : <GText soft>{t("Loading…", "جارٍ التحميل…")}</GText>}</Page>;
  return <Review key={`${r.id}-${r.status}-${String(r.validation?.validatedAt)}-${r.existingModel3dKey}`} r={r} work={work} busy={busy} error={error} discarding={discarding} setDiscarding={setDiscarding} />;
}

function Review({ r, work, busy, error, discarding, setDiscarding }: { r: ModelImport; work: (fn: () => Promise<unknown>) => Promise<void>; busy: boolean; error: string | null; discarding: boolean; setDiscarding: (v: boolean) => void }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const s = r.provenance;
  const config = r.viewerConfig;
  // a Sketchfab import that stopped before validation has only part of its config: never assume the lists exist
  const paintList = config?.paintMaterials ?? [], nodeList = config?.paintNodes ?? [];
  const orientation = r.validation?.sourceOrientation as { preRotateX?: number; rotateY?: number } | undefined;
  const gate = r.validation?.accessoryGate as ModelGate | null | undefined;
  const simplified = (r.validation?.simplified as { before: number; after: number } | null | undefined) ?? s?.optimization?.simplified;
  const [length, setLength] = useState(String(config?.lengthM ?? 4.5)), [up, setUp] = useState(String(Number(orientation?.preRotateX ?? 0) * 180 / Math.PI)), [heading, setHeading] = useState(String(Number(orientation?.rotateY ?? 0) * 180 / Math.PI));
  const [ground, setGround] = useState(String(config?.groundOffset ?? 0)), [paint, setPaint] = useState(paintList.join(", ")), [nodes, setNodes] = useState(nodeList.join(", "));
  const [verified, setVerified] = useState(false), [replace, setReplace] = useState(false), [notes, setNotes] = useState(""), [dirty, setDirty] = useState(false), [testPaint, setTestPaint] = useState(false), [sure, setSure] = useState(false);
  const changed = (set: (v: string) => void) => (v: string) => { set(v); setDirty(true); setVerified(false); };
  const names = (text: string) => text.split(",").map(x => x.trim()).filter(Boolean);
  const car = r.hasModel ? (config as CarModel | null) : null; // hasModel = validated, which saves a complete config
  const draft = r.status === "DRAFT" && !!r.errorCode;
  const reviewable = r.status === "READY" || r.status === "PUBLISHED" || ((r.status === "FAILED" || r.status === "DRAFT") && r.hasRawModel) || (!s && r.status !== "DISCARDED");
  const publishBlocked = busy || dirty || !verified || r.status !== "READY" || gate?.verdict === "REJECTED" || (!!r.existingModel3dKey && !replace);
  const validate = () => void work(async () => { setVerified(false); await vehicleCatalog.validate(r.id, { lengthM: Number(length), preRotateX: Number(up) * Math.PI / 180, rotateY: Number(heading) * Math.PI / 180, groundOffset: Number(ground), paintMaterials: names(paint), paintNodes: names(nodes) }); setDirty(false); });
  const actions: ItemAction[] = [
    ...(r.status === "FAILED" ? [{ key: "retry", label: t("Retry this import", "إعادة محاولة هذا الاستيراد"), icon: "refresh-outline" as const, disabled: busy, run: () => work(() => vehicleCatalog.retry(r.id)) }] : []),
    ...(r.status === "READY" ? [{ key: "map", label: t("Review part map privately", "مراجعة خريطة القطع بشكل خاص"), icon: "git-network-outline" as const, run: () => go(`/dept/accessory-zones?key=${encodeURIComponent(`import-${r.id}`)}`) }] : []),
    ...(r.status === "PUBLISHED" ? [{ key: "confirmMap", label: t("Confirm part map", "تأكيد خريطة القطع"), icon: "git-network-outline" as const, run: () => go(`/dept/accessory-zones?model3dKey=${encodeURIComponent(r.publishedModel3dKey ?? "")}`) }] : []),
    ...(!["PUBLISHED", "DISCARDED"].includes(r.status) ? [{ key: "discard", label: t("Discard this import", "استبعاد هذا الاستيراد"), icon: "trash-outline" as const, run: () => setDiscarding(true) }] : []),
  ];
  const footer = reviewable && r.status !== "PUBLISHED" ? (
    <View style={{ gap: 8 }}>
      <Toggle label={t("I visually verified identity, production period, orientation, wheels, grounding, paint and redistribution rights.", "تحققت بصريًا من الهوية وفترة الإنتاج والاتجاه والعجلات والأرضية والطلاء وحقوق إعادة التوزيع.")}
        value={verified} onChange={v => { if (r.hasModel && !busy && !dirty) setVerified(v); }} sub={!r.hasModel ? t("Validate the model first.", "تحقق من النموذج أولًا.") : dirty ? t("Validate the changed settings first.", "تحقق من الإعدادات المعدّلة أولًا.") : undefined} />
      {r.existingModel3dKey ? <Toggle label={t("Replace the current model: on approval the old model and its part map and fits are deleted", "استبدال النموذج الحالي: عند الاعتماد يُحذف النموذج القديم مع خريطة القطع والتركيبات")} value={replace} onChange={setReplace} /> : null}
      <GButton icon="checkmark-circle-outline" label={t("Approve and publish to customers", "اعتماد ونشر للعملاء")} busy={busy} disabled={publishBlocked}
        onPress={() => void work(() => vehicleCatalog.publish(r.id, { visuallyVerified: true, validationVersion: r.validation?.validatedAt, notes, ...(replace ? { replaceExistingKey: r.existingModel3dKey } : {}) }))} />
    </View>
  ) : undefined;
  return (
    <Page title={`${r.make} ${r.model} ${r.code}`} line={`${r.yearFrom}–${r.yearTo}`} actions={actions} footer={footer}>
      <View style={[row, { flexWrap: "wrap", gap: 8, alignItems: "center" }]}>
        <StatusChip label={draft ? t("Draft · needs your attention", "مسودة · تحتاج إلى مراجعتك") : t(...(IMPORT_LABELS[r.status] ?? IMPORT_LABELS.DRAFT!))} tone={r.status === "PUBLISHED" ? "success" : r.status === "FAILED" ? "danger" : draft || r.status === "READY" ? "accent" : "neutral"} />
        {typeof r.progress === "number" && runningImport(r.status) ? <GText soft style={gType.caption}>{`${r.progress}%`}</GText> : null}
      </View>
      {runningImport(r.status) ? <Note>{t("Preparation continues on the server. You can leave this screen and return later.", "يستمر تجهيز النموذج على الخادم. يمكنك مغادرة هذه الشاشة والعودة لاحقًا.")}</Note> : null}
      {r.errorCode ? <Note tone="danger">{failureText(r.failureDetail, t) ?? t(...(IMPORT_ERROR_LABELS[r.errorCode] ?? IMPORT_ERROR_LABELS.VALIDATION_REJECTED!))}</Note> : null}
      {draft ? <Note>{t("Kept as a draft: customers never see it. Change the settings below and tap \"Validate again\", or discard it.", "محفوظ كمسودة: لا يراه العملاء أبدًا. عدّل الإعدادات أدناه واضغط «التحقق مجددًا»، أو استبعده.")}</Note> : null}
      {r.status === "DISCARDED" ? <Note>{t("This import was discarded. Its source history is retained for audit and duplicate detection.", "استُبعد هذا الاستيراد. يُحتفظ بسجل المصدر للتدقيق واكتشاف التكرار.")}</Note> : null}
      {error ? <Note tone="danger">{error}</Note> : null}
      <Block title={t("Source and rights", "المصدر والحقوق")}>
        <Facts rows={[[t("Title", "العنوان"), s?.title ?? r.source], [t("Creator", "المنشئ"), r.author], [t("License", "الترخيص"), r.license],
          [t("Inspected", "تاريخ الفحص"), s?.inspectedAt ? new Date(s.inspectedAt).toLocaleString() : ""], [t("Sketchfab UID", "معرّف Sketchfab"), s?.uid ?? ""],
          [t("Original download", "التنزيل الأصلي"), s?.originalDownloadedBytes != null ? `${(s.originalDownloadedBytes / 1048576).toFixed(2)} MiB` : ""],
          [t("Prepared GLB", "ملف GLB المجهّز"), r.validation?.bytes ? `${(Number(r.validation.bytes) / 1048576).toFixed(2)} MiB` : ""],
          [t("Phones", "الهواتف"), simplified ? simplifiedText(simplified, t) : ""]]} />
        {s ? <View style={[row, { flexWrap: "wrap", gap: 4, paddingBottom: 8 }]}>
          {r.sourceUrl ? <GButton variant="ghost" icon="open-outline" label={t("Original model", "النموذج الأصلي")} onPress={() => void Linking.openURL(r.sourceUrl!)} /> : null}
          {s.authorUrl ? <GButton variant="ghost" icon="person-outline" label={t("Creator", "المنشئ")} onPress={() => void Linking.openURL(s.authorUrl!)} /> : null}
          {s.licenseUrl ? <GButton variant="ghost" icon="document-text-outline" label={t("License", "الترخيص")} onPress={() => void Linking.openURL(s.licenseUrl!)} /> : null}
        </View> : null}
        {s?.optimization?.warnings?.length ? <View style={{ gap: 6, paddingBottom: 8 }}>{s.optimization.warnings.map(w => <Note key={w}>{t(w, w.includes("Paint") ? "يتطلب تحديد أسطح الطلاء مراجعة؛ التلوين التلقائي معطّل." : w.includes("Front") ? "يتطلب اتجاه المقدمة تأكيدًا بصريًا." : "لم تُحذف المقصورة لأن أسماء العناصر غير واضحة.")}</Note>)}</View> : null}
      </Block>
      {reviewable ? <>
        <Block title={t("3D check", "الفحص ثلاثي الأبعاد")} action={r.hasModel ? <GButton variant="ghost" label={testPaint ? t("Original paint", "الطلاء الأصلي") : t("Test red paint", "تجربة الطلاء الأحمر")}
          onPress={() => setTestPaint(v => !v)} /> : undefined}>
          <View style={{ gap: 8, paddingVertical: 8 }}>
            {car ? <Car3DView key={JSON.stringify([r.validation, car])} model={testPaint ? car : { ...car, paintNodes: [], paintMaterials: [], bakedPaint: undefined }} assetLoader={() => authenticatedBase64(`${importPath}/${r.id}/model`)} interactive color="#c62828" bg={g.cardSoft} style={{ height: 300, borderRadius: 12 }} />
              : <GText soft style={[gType.caption, align]}>{t("Validate the model to see it in 3D.", "تحقق من النموذج لرؤيته ثلاثي الأبعاد.")}</GText>}
            {car ? <GText soft style={[gType.caption, align]}>{t("Only body paint may change; windows, tyres, lights and interior keep their finish.", "يتغير طلاء الهيكل فقط؛ تبقى النوافذ والإطارات والأضواء والمقصورة كما هي.")}</GText> : null}
            {r.validation ? <Facts rows={[[t("Technical validation", "التحقق التقني"), r.validation.valid ? t("Passed", "ناجح") : t("Failed", "فشل")],
              [t("Bytes / triangles", "بايت / مثلثات"), `${r.validation.bytes} / ${r.validation.triangles}`],
              [t("Dimensions (m)", "الأبعاد (م)"), Array.isArray(r.validation.dimensions) ? (r.validation.dimensions as unknown[]).map(n => Number(n).toFixed(2)).join(" × ") : ""]]} /> : null}
            {r.validation?.accessoryGate !== undefined ? <GateSummary gate={gate ?? null} /> : null}
          </View>
        </Block>
        {r.status !== "PUBLISHED" ? (
          <Block title={t("Settings", "الإعدادات")}>
            <View style={{ gap: 10, paddingVertical: 10 }}>
              <Field label={t("Vehicle length (m)", "طول المركبة (م)")} value={length} onChangeText={changed(setLength)} keyboardType="decimal-pad" />
              <Field label={t("Source up correction (degrees)", "تصحيح المحور الرأسي للمصدر (درجات)")} value={up} onChangeText={changed(setUp)} />
              <Field label={t("Source heading correction (degrees)", "تصحيح اتجاه مقدمة المصدر (درجات)")} value={heading} onChangeText={changed(setHeading)} />
              <Field label={t("Ground offset (m)", "الإزاحة عن الأرض (م)")} value={ground} onChangeText={changed(setGround)} />
              <Field label={t("Paint materials (comma separated)", "خامات الطلاء (مفصولة بفواصل)")} value={paint} onChangeText={changed(setPaint)} />
              <Field label={t("Paint nodes (optional, comma separated)", "عناصر الطلاء (اختيارية، مفصولة بفواصل)")} value={nodes} onChangeText={changed(setNodes)} />
              <GText soft style={[gType.caption, align]}>{t("Orientation corrections are applied to the original source. Verify front +Z, upright body, wheels and grounding after validation.", "تُطبّق تصحيحات الاتجاه على المصدر الأصلي. تحقق من المقدمة +Z والاستقامة والعجلات والأرضية بعد التحقق.")}</GText>
              <GButton variant="secondary" icon="refresh-outline" label={t("Validate again / prepare preview", "التحقق مجددًا / تجهيز العرض")} disabled={busy} onPress={validate} />
              <Field label={t("Review notes", "ملاحظات المراجعة")} value={notes} onChangeText={setNotes} multiline />
            </View>
          </Block>
        ) : null}
        <Block title={t("Part-map proposal", "اقتراح خريطة القطع")}>
          <GText soft style={[gType.caption, align, { paddingVertical: 10 }]}>{r.partMapStatus === "CONFIRMED" ? t("Confirmed for this exact GLB revision.", "مؤكدة لهذه النسخة المحددة من GLB.") : r.validation?.partMap ? t("Saved for this exact GLB revision. Unresolved parts remain available for admin review.", "حُفظ الاقتراح لهذه النسخة من GLB. تبقى القطع غير المحددة متاحة لمراجعة الإدارة.") : t("No automatic proposal available.", "لا يوجد اقتراح تلقائي.")}</GText>
          {r.status === "PUBLISHED" ? <GText soft style={[gType.caption, align, { paddingBottom: 10 }]}>{`${t("Published to the selected generation", "نُشر للجيل المحدد")} · ${r.publishedModel3dKey ?? ""}`}</GText> : null}
        </Block>
      </> : null}
      {discarding ? (
        <Block title={t("Discard this import", "استبعاد هذا الاستيراد")}>
          <View style={{ gap: 10, paddingVertical: 10 }}>
            <Toggle label={t("Discard this unpublished import and its private prepared files", "استبعاد هذا الاستيراد غير المنشور وملفاته المجهّزة الخاصة")} value={sure} onChange={setSure} />
            <View style={[row, { gap: 10 }]}>
              <GButton flex variant="secondary" label={t("Cancel", "إلغاء")} onPress={() => { setDiscarding(false); setSure(false); }} />
              <GButton flex variant="danger" label={t("Discard", "استبعاد")} disabled={!sure || busy} onPress={() => void work(() => vehicleCatalog.discard(r.id)).then(() => setDiscarding(false))} />
            </View>
          </View>
        </Block>
      ) : null}
    </Page>
  );
}
