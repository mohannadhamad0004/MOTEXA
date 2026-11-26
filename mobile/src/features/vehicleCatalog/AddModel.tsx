// "Add 3D model" (/dept/3d/add, ?generationId= replaces that generation's model, ?url= pre-fills the link): ONE Form screen.
// Paste a Sketchfab link -> checked automatically ~0.5 s after typing stops -> preview card -> the car (brand / model / generation)
// suggested from the model's title and tags, editable -> Import. "Upload a GLB instead" is the secondary way on the same screen.
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Field, GButton, GText, Note, StatusChip } from "../../components/garage";
import { ManageEntry } from "../../components/manage/ManagePage";
import { Block, Page } from "../../components/manage/Page";
import { localFileToBase64 } from "../../core/constants/files";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../theme/garage";
import { vehicleCatalog, type SketchfabInspection } from "./api";
import { guessCar } from "./carGuess";
import { IMPORT_ERROR_LABELS, importError, trianglesShort } from "./importState";
import { threeDError } from "./lifecycleText";
import { NO_CAR, VehiclePickers, carOf, type CarPick } from "./VehiclePickers";

const looksLikeLink = (s: string) => /sketchfab\.com\//i.test(s) && s.trim().length >= 24;

export function AddModel() {
  const params = useLocalSearchParams<{ generationId?: string; url?: string }>();
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const tax = useLoad(vehicleCatalog.list, []);
  const [mode, setMode] = useState<"link" | "file">("link");
  const [car, setCar] = useState<CarPick>(NO_CAR), touched = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  // replacing a generation's model: that generation is chosen and stays chosen
  useEffect(() => { if (params.generationId && tax.data && !touched.current) { setCar(carOf(tax.data, params.generationId)); touched.current = true; } }, [params.generationId, tax.data]);
  const pick = (v: CarPick) => { touched.current = true; setCar(v); };
  const generation = tax.data?.vehicles.flatMap(v => v.generations).find(g => g.id === car.generationId) ?? null;

  // ---- the link: checked automatically, the newest answer wins
  const [url, setUrl] = useState(params.url ?? ""), [inspection, setInspection] = useState<SketchfabInspection | null>(null);
  const [checking, setChecking] = useState(false), [linkError, setLinkError] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(() => {
    const mine = ++request.current;
    setInspection(null); setLinkError(null); setChecking(false);
    const u = url.trim();
    if (!u) return;
    if (!looksLikeLink(u)) { const id = setTimeout(() => mine === request.current && setLinkError(t(...IMPORT_ERROR_LABELS.INVALID_SKETCHFAB_URL)), 900); return () => clearTimeout(id); }
    setChecking(true);
    const id = setTimeout(() => {
      vehicleCatalog.inspect(u).then(r => { if (mine === request.current) setInspection(r); })
        .catch(e => { if (mine === request.current) setLinkError(importError(e, t)); })
        .finally(() => { if (mine === request.current) setChecking(false); });
    }, 500);
    return () => clearTimeout(id);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the car, suggested from the model's title and tags (+ the catalog's generations for that year)
  const [suggested, setSuggested] = useState<{ brands?: string[]; models?: string[]; generations?: string[] }>({});
  useEffect(() => {
    if (!inspection || !tax.data) return;
    let live = true;
    const guess = guessCar(inspection.title, inspection.tags ?? [], tax.data);
    void (async () => {
      let gens = guess.generationId ? [guess.generationId] : [];
      if (guess.make && guess.model && guess.year) {
        try { const s = await vehicleCatalog.suggestions(guess.make, guess.model, guess.year); gens = [...new Set([...gens, ...s.generations.map(g => g.id)])]; } catch { /* suggestions only */ }
      }
      if (!live) return;
      setSuggested({ brands: guess.brandId ? [guess.brandId] : [], models: guess.modelId ? [guess.modelId] : [], generations: gens });
      if (!touched.current && guess.brandId) setCar({ brandId: guess.brandId, modelId: guess.modelId ?? "", generationId: guess.generationId ?? (guess.modelId && gens.length === 1 ? gens[0]! : "") });
    })();
    return () => { live = false; };
  }, [inspection?.uid, tax.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the file (secondary way)
  const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
  const [length, setLength] = useState("4.5"), [source, setSource] = useState(""), [author, setAuthor] = useState(""), [license, setLicense] = useState(""), [sourceUrl, setSourceUrl] = useState("");
  const chooseFile = () => {
    setError(null);
    void DocumentPicker.getDocumentAsync({ type: ["model/gltf-binary", "application/octet-stream", "*/*"], copyToCacheDirectory: true }).then(r => {
      if (r.canceled) return;
      const a = r.assets[0]!;
      if (!a.name.toLowerCase().endsWith(".glb") || (a.size ?? 0) > 20 * 1024 * 1024) { setError(t("Choose a .glb file up to 20 MB.", "اختر ملف .glb بحجم أقصاه 20 ميجابايت.")); return; }
      setFile(a);
    }).catch(e => setError(threeDError(e, t)));
  };

  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setError(null);
    try { const id = await fn(); router.replace(`/dept/vehicles/imports/${id}` as Href); }
    catch (e) { setError(mode === "link" ? importError(e, t) : threeDError(e, t)); }
    finally { setBusy(false); }
  };
  const canImport = !!inspection?.allowed && !inspection.duplicate && !!generation;
  const canUpload = !!file && !!generation && !!source.trim() && !!author.trim() && !!license.trim();
  const footer = mode === "link"
    ? <GButton icon="cloud-download-outline" label={t("Import", "استيراد")} busy={busy} disabled={busy || !canImport}
        onPress={() => void run(async () => (await vehicleCatalog.importSketchfab({ url: inspection!.url, generationId: generation!.id, yearFrom: generation!.yearFrom, yearTo: generation!.yearTo })).id)} />
    : <GButton icon="cloud-upload-outline" label={t("Upload for validation", "الرفع للتحقق")} busy={busy} disabled={busy || !canUpload}
        onPress={() => void run(async () => (await vehicleCatalog.upload({ generationId: generation!.id, source, author, license, sourceUrl, lengthM: Number(length), dataBase64: await localFileToBase64(file!.uri) })).id)} />;
  const s = inspection;
  return (
    <Page title={t("Add 3D model", "إضافة نموذج ثلاثي الأبعاد")} footer={footer}
      line={params.generationId ? t("Replacing a car's model", "استبدال نموذج سيارة") : mode === "link" ? t("From a Sketchfab link", "من رابط Sketchfab") : t("From your own GLB file", "من ملف GLB خاص بك")}>
      {params.generationId ? <Note>{t("Customers keep the current model until you approve the new one; on approval the old model is deleted.", "يبقى النموذج الحالي ظاهرًا للعملاء إلى أن تعتمد الجديد، وعند الاعتماد يُحذف النموذج القديم.")}</Note> : null}
      {mode === "link" ? (
        <Block title={t("Sketchfab link", "رابط Sketchfab")}>
          <View style={{ paddingVertical: 10, gap: 8 }}>
            <Field label={t("Paste the model's link", "الصق رابط النموذج")} value={url} onChangeText={setUrl} placeholder="https://sketchfab.com/3d-models/…" autoCapitalize="none" />
            {checking ? <GText soft style={[gType.caption, align]}>{t("Checking the link…", "جارٍ فحص الرابط…")}</GText> : null}
            {linkError ? <Note tone="danger">{linkError}</Note> : null}
            {!url.trim() ? <GText soft style={[gType.caption, align]}>{t("Any downloadable model with a Creative Commons license is accepted; heavy models are simplified for phones.", "يُقبل أي نموذج متاح للتنزيل بترخيص المشاع الإبداعي؛ وتُبسَّط النماذج الثقيلة للهواتف.")}</GText> : null}
          </View>
        </Block>
      ) : null}
      {mode === "link" && s ? (
        <Block title={t("Model", "النموذج")}>
          <View style={{ paddingVertical: 10, gap: 8 }}>
            {s.thumbnail ? <Image accessibilityLabel={t("Sketchfab model thumbnail", "صورة النموذج من Sketchfab")} source={{ uri: s.thumbnail }} style={{ width: "100%", height: 170, borderRadius: 12 }} contentFit="contain" /> : null}
            <GText style={[gType.label, align, { fontWeight: "800" }]}>{s.title}</GText>
            <GText soft style={[gType.caption, align]}>{`${t("by", "بواسطة")} ${s.author}`}</GText>
            <View style={[row, { flexWrap: "wrap", gap: 8, alignItems: "center" }]}>
              <StatusChip label={s.license} tone={s.allowed ? "success" : "danger"} />
              {s.triangles ? <GText soft style={gType.caption}>{t(`About ${trianglesShort(s.triangles)[0]} triangles`, `حوالي ${trianglesShort(s.triangles)[1]} مثلث`)}</GText> : null}
            </View>
            {!s.allowed ? <Note tone="danger">{t(...(IMPORT_ERROR_LABELS[s.refusalCode ?? "LICENSE_NOT_ALLOWED"] ?? IMPORT_ERROR_LABELS.LICENSE_NOT_ALLOWED))}</Note> : null}
            {s.duplicate ? <Note tone="warning">{`${t(...IMPORT_ERROR_LABELS.DUPLICATE_IMPORT)} ${s.duplicate.name}`}</Note> : null}
            {s.duplicate?.importId ? <GButton variant="ghost" label={t("Open the existing import", "فتح الاستيراد الموجود")} onPress={() => router.push(`/dept/vehicles/imports/${s.duplicate!.importId}` as Href)} />
              : s.duplicate?.model3dKey ? <GButton variant="ghost" label={t("Open this 3D model", "فتح هذا النموذج")} onPress={() => router.push(`/dept/3d/vehicles/${s.duplicate!.model3dKey}` as Href)} /> : null}
            <View style={[row, { flexWrap: "wrap", gap: 4 }]}>
              <GButton variant="ghost" icon="open-outline" label={t("Sketchfab", "Sketchfab")} onPress={() => void Linking.openURL(s.url)} />
              {s.authorUrl ? <GButton variant="ghost" icon="person-outline" label={t("Creator", "المنشئ")} onPress={() => void Linking.openURL(s.authorUrl!)} /> : null}
              {s.licenseUrl ? <GButton variant="ghost" icon="document-text-outline" label={t("License", "الترخيص")} onPress={() => void Linking.openURL(s.licenseUrl!)} /> : null}
            </View>
          </View>
        </Block>
      ) : null}
      <Block title={t("Car", "السيارة")}>
        <View style={{ paddingVertical: 10, gap: 8 }}>
          {tax.data ? <VehiclePickers tax={tax.data} value={car} onChange={pick} reload={tax.reload} suggested={suggested}
            hint={suggested.brands?.length ? t("Suggested from the model's title and tags. Change it if needed.", "مقترح من عنوان النموذج ووسومه. غيّره عند الحاجة.") : undefined} />
            : tax.error ? <Note tone="danger">{threeDError({ message: tax.error }, t)}</Note> : <GText soft style={align}>{t("Loading…", "جارٍ التحميل…")}</GText>}
          {generation ? <GText soft style={[gType.caption, align]}>{`${t("Production years", "سنوات الإنتاج")}: ${generation.yearFrom}–${generation.yearTo}`}</GText> : null}
        </View>
      </Block>
      {mode === "file" ? (
        <Block title={t("File and rights", "الملف والحقوق")}>
          <View style={{ paddingVertical: 10, gap: 10 }}>
            <GButton variant="secondary" icon="document-attach-outline" label={file ? file.name : t("Choose a GLB file", "اختيار ملف GLB")} disabled={busy} onPress={chooseFile} />
            <Field label={t("Vehicle length (metres)", "طول المركبة (متر)")} value={length} onChangeText={setLength} keyboardType="decimal-pad" />
            <Field label={t("Source / provenance", "المصدر / أصل النموذج")} value={source} onChangeText={setSource} />
            <Field label={t("Author / rights holder", "المؤلف / صاحب الحقوق")} value={author} onChangeText={setAuthor} />
            <Field label={t("License / redistribution permission", "الترخيص / إذن إعادة التوزيع")} value={license} onChangeText={setLicense} />
            <Field label={t("Source HTTPS URL (optional)", "رابط المصدر HTTPS (اختياري)")} value={sourceUrl} onChangeText={setSourceUrl} autoCapitalize="none" />
          </View>
        </Block>
      ) : null}
      {error ? <Note tone="danger">{error}</Note> : null}
      <ManageEntry icon={mode === "link" ? "cloud-upload-outline" : "link-outline"}
        title={mode === "link" ? t("Upload a GLB file instead", "رفع ملف GLB بدلًا من ذلك") : t("Use a Sketchfab link instead", "استخدام رابط Sketchfab بدلًا من ذلك")}
        sub={mode === "link" ? t("Your own model, checked before anyone sees it", "نموذجك الخاص، يُفحص قبل أن يراه أحد") : undefined}
        onPress={() => { setError(null); setMode(m => (m === "link" ? "file" : "link")); }} />
    </Page>
  );
}
