// Provider application review (/dept/review/shop|company|garage/:id) on the Detail template: header (name, kind · owner, ⋮), status, messages,
// facts, location, documents (accept / reject each), the approval checklist, trucks or products, history. ONE primary action at the
// bottom (Approve, enabled when the checklist passes; the server checks it again) with Request changes beside it; Reject is in ⋮.
import { Image } from "expo-image";
import { Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Chip, Field, GButton, GIcon, GText, Note, SearchBar, Sheet, StatusChip } from "../../components/garage";
import { ReasonSheet } from "../../components/manage/Form";
import { FilterChips, ManageEntry, ManageRow, appStatus } from "../../components/manage/ManagePage";
import { Block, CheckRow, Facts, History, Page } from "../../components/manage/Page";
import { type ItemAction } from "../../components/ItemActionsMenu";
import { CATALOG_GROUPS } from "../../core/constants/categories";
import { cityLabel } from "../../core/constants/cities";
import { formatPrice } from "../../core/constants/money";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { hapticError, hapticSuccess } from "../../motion";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { type Product, partsAdminService } from "../parts/partsService";
import { type Application, type Doc, type Kind, review } from "../provider/api";
import { actionLabel, docLabel, fmtDay, fmtTime, keyLabel, truckTypeLabel } from "../provider/labels";
import { useDocViewer } from "../provider/ui";
import { privateImageSource } from "../shared/api";
import { towAdminService } from "../tow/towService";
import { productActions } from "./itemActions";
import { useSkillLabel } from "../mechanics/mechanicBits";
import { LocationRow } from "./LocationRow";
import { truckActions } from "./towActions";

const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const ltr = (v: string) => "⁦" + v + "⁩";
const CATALOG_FLAT = new Map(CATALOG_GROUPS.flatMap(g => g.categories).map(c => [c.key, c]));
const FIELDS: Record<Kind, string[]> = {
  TOW: ["name", "ownerName", "phone", "city", "address", "location", "workingHours", "serviceCities", "truckTypes", "truck"],
  PARTS: ["name", "ownerName", "phone", "city", "address", "location", "workingHours", "categories", "brands"],
  GARAGE: ["name", "ownerName", "phone", "city", "address", "location", "workingHours", "services", "description"],
};
const KIND_LABEL: Record<Kind, [string, string]> = { TOW: ["Tow company", "شركة سحب"], PARTS: ["Parts shop", "متجر قطع غيار"], GARAGE: ["Garage", "كراج"] };
type Decision = { status: "ACCEPTED" } | { status: "REJECTED"; reason: string };

function usePrivate(uri: string, on = true) {
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  useEffect(() => { let alive = true; if (on) privateImageSource(uri).then(s => alive && setSrc(s), () => {}); return () => { alive = false; }; }, [uri, on]);
  return src;
}

/** One document: its thumbnail (opens full screen), state, expiry, and Accept / Reject while the application is under review. */
function DocTile({ doc, canDecide, onDecide }: { doc: Doc; canDecide: boolean; onDecide: (x: Decision) => Promise<void> }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const viewer = useDocViewer();
  const image = doc.mimeType.startsWith("image/");
  const src = usePrivate(doc.uri, image);
  const [rejecting, setRejecting] = useState(false), [busy, setBusy] = useState(false);
  const run = async (x: Decision) => { setBusy(true); try { await onDecide(x); setRejecting(false); } finally { setBusy(false); } };
  const label = docLabel(t, doc.kind);
  const expired = doc.expiresAt ? new Date(doc.expiresAt).getTime() < Date.now() : false;
  return (
    <View style={{ width: "48.5%", gap: 6, padding: 8, borderRadius: gShape.small, borderWidth: 1, borderColor: doc.status === "REJECTED" ? g.danger : g.line, backgroundColor: g.card }}>
      {viewer.element}
      <Pressable accessibilityRole="button" accessibilityLabel={`${t("Open", "فتح")} ${label}`} onPress={() => viewer.open({ uri: doc.uri, label, mimeType: doc.mimeType })}
        style={{ height: 96, borderRadius: 10, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
        {src ? <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <GIcon name={image ? "image-outline" : "document-text-outline"} size={30} color={g.soft} />}
      </Pressable>
      <GText numberOfLines={2} style={[gType.caption, align, { fontWeight: "800" }]}>{label}</GText>
      <View style={[row, { flexWrap: "wrap", gap: 4 }]}><StatusChip {...appStatus(doc.status, t, "doc")} /></View>
      {doc.expiresAt ? <GText style={[gType.tiny, align, { color: expired ? g.danger : g.soft }]}>{`${expired ? t("Expired", "منتهٍ") : t("Expires", "ينتهي")} ${fmtDay(doc.expiresAt)}`}</GText> : null}
      {doc.status === "REJECTED" && doc.reason ? <GText style={[gType.tiny, align, { color: g.danger }]}>{doc.reason}</GText> : null}
      {canDecide ? (
        <View style={{ gap: 6 }}>
          {doc.status !== "ACCEPTED" ? <GButton variant="secondary" icon="checkmark" label={t("Accept", "قبول")} disabled={busy} onPress={() => void run({ status: "ACCEPTED" })} /> : null}
          {doc.status !== "REJECTED" ? <GButton variant="ghost" label={t("Reject", "رفض")} disabled={busy} onPress={() => setRejecting(true)} /> : null}
        </View>
      ) : null}
      <ReasonSheet visible={rejecting} title={t("Reject this document", "رفض هذا المستند")} prompt={t("Why is it rejected? The owner will see this. (required)", "لماذا رُفض؟ سيراه المالك. (مطلوب)")}
        confirmLabel={t("Reject document", "رفض المستند")} danger busy={busy} onCancel={() => setRejecting(false)} onConfirm={reason => void run({ status: "REJECTED", reason })} />
    </View>
  );
}
function DocGrid({ docs, canDecide, decide }: { docs: Doc[]; canDecide: boolean; decide: (id: string) => (x: Decision) => Promise<void> }) {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  if (!docs.length) return <GText soft style={[gType.caption, align]}>{t("No documents uploaded.", "لم يتم رفع مستندات.")}</GText>;
  return <View style={[row, { flexWrap: "wrap", gap: 8, paddingVertical: 8 }]}>{docs.map(x => <DocTile key={x.id} doc={x} canDecide={canDecide} onDecide={decide(x.id)} />)}</View>;
}

/** Request changes: the fields and documents to fix, and a message to the owner (both required). */
function ChangesSheet({ app, visible, onSend, onCancel }: { app: Application; visible: boolean; onSend: (d: { message: string; fields: string[]; documentIds: string[] }) => Promise<void>; onCancel: () => void }) {
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const [fields, setFields] = useState<string[]>([]), [docs, setDocs] = useState<string[]>([]), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { if (visible) { setFields([]); setDocs([]); setMessage(""); setError(""); } }, [visible]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const all = [...app.documents, ...app.trucks.flatMap(x => x.documents)];
  const send = async () => {
    if (!message.trim()) return setError(t("A message is required.", "الرسالة مطلوبة."));
    if (!fields.length && !docs.length) return setError(t("Select at least one field or document.", "اختر حقلًا أو مستندًا واحدًا على الأقل."));
    setBusy(true); setError("");
    try { await onSend({ message: message.trim(), fields, documentIds: docs }); } catch (e) { setError(e instanceof Error ? e.message : t("Could not send.", "تعذّر الإرسال.")); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onCancel} tall title={t("Request changes", "طلب تعديلات")} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 12 }}>
        <GText style={[gType.label, align, { fontWeight: "800" }]}>{t("Fields to fix", "الحقول المطلوب تصحيحها")}</GText>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{FIELDS[app.kind].map(k => <Chip key={k} label={keyLabel(t, k)} on={fields.includes(k)} onPress={() => setFields(toggle(fields, k))} />)}</View>
        <GText style={[gType.label, align, { fontWeight: "800" }]}>{t("Documents to replace", "المستندات المطلوب استبدالها")}</GText>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{all.map(x => <Chip key={x.id} label={docLabel(t, x.kind)} on={docs.includes(x.id)} onPress={() => setDocs(toggle(docs, x.id))} />)}</View>
        <Field label={t("Message to the owner (required)", "رسالة إلى المالك (مطلوبة)")} value={message} onChangeText={setMessage} multiline maxLength={1000} />
        {error ? <Note tone="danger">{error}</Note> : null}
        <View style={[row, { gap: 10 }]}>
          <GButton flex variant="secondary" label={t("Cancel", "إلغاء")} disabled={busy} onPress={onCancel} />
          <GButton flex icon="send-outline" label={t("Send", "إرسال")} busy={busy} disabled={busy} onPress={() => void send()} />
        </View>
      </View>
    </Sheet>
  );
}

/** A product of the shop under review: hide / show, edit, add a photo (⋮); details open in a sheet. */
function productState(p: Product, t: (en: string, ar: string) => string) {
  if (p.customerVisible) return { label: t("Customer visible", "ظاهر للعملاء"), tone: "success" as const };
  if (p.hidden) return { label: t("Hidden by MOTEXA", "مخفي من موتكسا"), tone: "danger" as const };
  if (p.hasPhoto === false) return { label: t("Photo required", "الصورة مطلوبة"), tone: "warning" as const };
  return { label: t("Shop not approved", "المتجر غير معتمد"), tone: "neutral" as const };
}

export function ApplicationReview({ kind, id }: { kind: Kind; id: string }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const state = useLoad(() => review.get(kind, id), [kind, id], 15000);
  const skill = useSkillLabel();
  const products = useLoad(async () => (kind === "PARTS" ? (await partsAdminService.getShop(NOACTOR, id)).products : []), [kind, id, state.data?.status]);
  // out-of-service state of the company's trucks (the review payload does not carry it)
  const fleet = useLoad(async () => (kind === "TOW" ? (await towAdminService.listTrucks(NOACTOR)).filter(x => x.companyId === id) : []), [kind, id, state.data?.status]);
  const [mode, setMode] = useState<null | "changes" | "reject">(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [pq, setPq] = useState(""), [pf, setPf] = useState<"ALL" | "VISIBLE" | "HIDDEN" | "NOPHOTO">("ALL"), [productOpen, setProductOpen] = useState<Product | null>(null);
  const storefront = useDocViewer();
  const guard = async (work: () => Promise<unknown>) => {
    setError(""); setBusy(true);
    try { await work(); hapticSuccess(); setMode(null); await state.reload(); }
    catch (e) { hapticError(); setError(e instanceof Error ? e.message : t("Something went wrong.", "حدث خطأ ما.")); }
    finally { setBusy(false); }
  };
  const a = state.data, i = a?.info;
  const reviewing = a?.status === "PENDING";
  const items = a?.checklist ?? [];
  const allOk = items.length > 0 && items.every(c => c.ok);
  const front = a?.documents.find(x => (kind === "PARTS" ? x.kind === "STOREFRONT_PHOTO" : kind === "GARAGE" && x.kind === "WORKSHOP_PHOTO") && x.mimeType.startsWith("image/"));
  const frontSrc = usePrivate(front?.uri ?? "", !!front);
  const decide = (docId: string) => (x: Decision) => review.decideDoc(kind, id, docId, x).then(() => state.reload()).then(() => undefined);
  const actions: ItemAction[] = a ? [
    ...(kind !== "GARAGE" ? [{ key: "edit", label: kind === "PARTS" ? t("Edit shop details", "تعديل بيانات المتجر") : t("Edit company details", "تعديل بيانات الشركة"), icon: "create-outline" as const, run: () => go(kind === "PARTS" ? `/dept/edit/shop/${id}` : `/dept/edit/company/${id}`) }] : []),
    { key: "messages", label: t("Messages with the owner", "الرسائل مع المالك"), icon: "chatbubbles-outline", run: () => go(`/dept/thread/${kind}/${id}`) },
    ...(reviewing ? [{ key: "reject", label: t("Reject application", "رفض الطلب"), icon: "close-circle-outline" as const, run: () => setMode("reject") }] : []),
  ] : [];
  const footer = a && reviewing ? (
    <View style={{ gap: 8 }}>
      {!allOk ? <GText style={[gType.caption, { textAlign: "center", color: g.accentText, fontWeight: "700" }]}>{t("Accept every required document to enable Approve.", "اقبل كل المستندات المطلوبة لتفعيل الموافقة.")}</GText> : null}
      <View style={[row, { gap: 10 }]}>
        <GButton flex variant="secondary" icon="create-outline" label={t("Request changes", "طلب تعديلات")} disabled={busy} onPress={() => setMode("changes")} />
        <GButton flex icon="checkmark-circle" label={t("Approve", "موافقة")} busy={busy} disabled={busy || !allOk} onPress={() => void guard(() => review.approve(kind, id))} />
      </View>
    </View>
  ) : undefined;
  const list = (products.data ?? []).filter(p => {
    const n = pq.trim().toLowerCase();
    if (n && ![p.name, p.brand, p.partNumber].join(" ").toLowerCase().includes(n)) return false;
    return pf === "ALL" || (pf === "VISIBLE" && p.customerVisible) || (pf === "HIDDEN" && p.hidden) || (pf === "NOPHOTO" && p.hasPhoto === false);
  });
  const flagged = a?.flaggedFields.filter(k => !k.startsWith("doc:")) ?? [];
  return (
    <Page title={i?.name ?? t("Application", "الطلب")} line={a ? `${t(...KIND_LABEL[kind])} · ${a.owner.fullName}` : undefined}
      actions={actions} footer={footer} onRefresh={() => void state.reload()} refreshing={state.loading && !!a}>
      {state.error && !a ? <Note tone="danger">{state.error}</Note> : null}
      {!a && !state.error ? <GText soft style={align}>{t("Loading…", "جارٍ التحميل…")}</GText> : null}
      {a && i ? <>
        <View style={[row, { flexWrap: "wrap", gap: 8, alignItems: "center" }]}>
          <StatusChip {...appStatus(a.status, t)} />
          {a.submittedAt ? <GText soft style={gType.caption}>{`${t("Submitted", "أُرسل")} ${fmtDay(a.submittedAt)}`}</GText> : null}
          {a.submissionVersion > 1 ? <GText soft style={gType.caption}>{`${t("Submission", "الإرسال")} ${a.submissionVersion}`}</GText> : null}
        </View>
        {error ? <Note tone="danger">{error}</Note> : null}
        {a.status === "REJECTED" && a.rejectionReason ? <Note tone="danger" icon="close-circle-outline">{`${t("Rejection reason", "سبب الرفض")}: ${a.rejectionReason}`}</Note> : null}
        <ManageEntry icon="chatbubbles-outline" title={t("Messages with the owner", "الرسائل مع المالك")} sub={a.unreadMessages ? t(`${a.unreadMessages} unread`, `${a.unreadMessages} غير مقروءة`) : undefined} onPress={() => go(`/dept/thread/${kind}/${id}`)} />
        {front ? (
          <Pressable accessibilityRole="button" accessibilityLabel={docLabel(t, front.kind)} onPress={() => storefront.open({ uri: front.uri, label: docLabel(t, front.kind), mimeType: front.mimeType })}
            style={{ height: 170, borderRadius: gShape.small, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
            {storefront.element}
            {frontSrc ? <Image source={frontSrc} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <GIcon name="storefront-outline" size={40} color={g.soft} />}
          </Pressable>
        ) : null}
        <Block title={t("Business", "النشاط")}>
          <Facts rows={[
            [t("Arabic name", "الاسم بالعربية"), i.nameAr], [t("Owner", "المالك"), i.ownerName], [t("Email", "البريد الإلكتروني"), a.owner.email],
            [t("Phone", "الهاتف"), i.phone ? ltr(i.phone) : ""], [t("City", "المدينة"), i.city ? cityLabel(i.city, isArabic) : ""], [t("Address", "العنوان"), i.address],
            [t("Working hours", "ساعات العمل"), i.open24h ? t("Open 24/7", "على مدار الساعة") : i.workingHours],
            ...(kind === "TOW" ? [
              [t("Coverage", "التغطية"), (i.serviceCities ?? []).map((c: string) => cityLabel(c, isArabic)).join(isArabic ? "، " : ", ")] as [string, string],
              [t("Truck types", "أنواع الشاحنات"), (i.truckTypes ?? []).map((k: string) => truckTypeLabel(t, k)).join(isArabic ? "، " : ", ")] as [string, string],
              [t("Trucks claimed", "عدد الشاحنات المعلن"), i.truckCountClaimed != null ? String(i.truckCountClaimed) : ""] as [string, string],
            ] : kind === "GARAGE" ? [
              [t("Services", "الخدمات"), (i.services ?? []).map((k: string) => skill(k)).join(isArabic ? "، " : ", ")] as [string, string],
              [t("Description", "الوصف"), i.description] as [string, string],
            ] : [
              [t("Categories", "الفئات"), (i.categories ?? []).map((k: string) => { const c = CATALOG_FLAT.get(k); return c ? (isArabic ? c.ar : c.en) : ""; }).filter(Boolean).join(isArabic ? "، " : ", ")] as [string, string],
              [t("Main brands", "العلامات التجارية"), (i.brands ?? []).join(", ")] as [string, string],
              [t("Brand / company", "العلامة / الشركة"), i.brandName] as [string, string], [t("Branch", "الفرع"), i.branchName] as [string, string],
            ]),
          ]} />
        </Block>
        {flagged.length ? <Note tone="warning" icon="flag">{`${t("Flagged", "محدد للتصحيح")}: ${flagged.map(k => keyLabel(t, k)).join(isArabic ? "، " : ", ")}`}</Note> : null}
        <LocationRow point={i.baseLat != null && i.baseLng != null ? { lat: i.baseLat, lng: i.baseLng } : null} city={i.city} address={i.address}
          buttonLabel={t("View on map", "عرض على الخريطة")} emptyLabel={t("The owner has not set a location yet.", "لم يحدد المالك موقعًا بعد.")}
          onPress={() => go(`/dept/map?lat=${i.baseLat}&lng=${i.baseLng}&name=${encodeURIComponent(i.name ?? "")}`)} />
        <Block title={t("Documents", "المستندات")}>
          <DocGrid docs={a.documents} canDecide={!!reviewing} decide={decide} />
          {a.trucks.map(x => (
            <View key={x.id} style={{ paddingVertical: 6, gap: 6, borderTopWidth: 1, borderTopColor: g.line }}>
              <GText style={[gType.label, align, { fontWeight: "800" }]}>{`${truckTypeLabel(t, x.type)} · ${ltr(x.plate)}`}</GText>
              {[x.make, x.model, x.year].some(Boolean) ? <GText soft style={[gType.caption, align]}>{[x.make, x.model, x.year].filter(Boolean).join(" ")}</GText> : null}
              {x.baseLat != null && x.baseLng != null ? <LocationRow point={{ lat: x.baseLat, lng: x.baseLng }} address={x.locationAddress} buttonLabel={t("View truck location", "عرض موقع الشاحنة")}
                onPress={() => go(`/dept/map?lat=${x.baseLat}&lng=${x.baseLng}&name=${encodeURIComponent(x.plate)}`)} /> : null}
              <DocGrid docs={x.documents} canDecide={!!reviewing} decide={decide} />
            </View>
          ))}
        </Block>
        <Block title={t("Approval checklist", "قائمة التحقق")}>
          {items.map(c => <CheckRow key={c.key} ok={c.ok} label={keyLabel(t, c.key)}
            hint={c.ok ? undefined : c.key === "truck" ? t(`${c.detail ?? "0/0"} trucks have an accepted photo, registration and insurance or operating licence`, `${c.detail ?? "0/0"} شاحنات لديها صورة وترخيص وتأمين أو رخصة تشغيل مقبولة`) : undefined} />)}
        </Block>
        {kind === "TOW" ? (
          <Block title={`${t("Trucks", "الشاحنات")} (${a.trucks.length})`} action={<GButton variant="ghost" icon="add-circle-outline" label={t("Add truck", "إضافة شاحنة")} onPress={() => go(`/dept/edit/truck/new?companyId=${id}`)} />}>
            {a.trucks.length ? a.trucks.map(x => <ManageRow key={x.id} title={`${truckTypeLabel(t, x.type)} · ${ltr(x.plate)}`}
              sub={fleet.data?.find(f => f.id === x.id)?.archivedAt ? t("Out of service", "خارج الخدمة") : undefined} status={appStatus(x.verification, t)}
              onPress={() => go(`/dept/review/truck/${x.id}`)} actions={truckActions(t, { ...x, companyId: id } as never, () => state.reload())} />)
              : <GText soft style={[gType.caption, align, { paddingVertical: 10 }]}>{t("This company has no trucks yet.", "لا توجد شاحنات لهذه الشركة بعد.")}</GText>}
          </Block>
        ) : null}
        {kind === "PARTS" ? (
          <Block title={`${t("Products", "المنتجات")} (${products.data?.length ?? 0})`} action={<GButton variant="ghost" icon="add-circle-outline" label={t("Add product", "إضافة منتج")} onPress={() => go(`/dept/edit/product/new?shopId=${id}`)} />}>
            {(products.data ?? []).length ? (
              <View style={{ gap: 8, paddingVertical: 8 }}>
                <SearchBar value={pq} onChangeText={setPq} placeholder={t("Search name, brand or part number", "ابحث بالاسم أو الماركة أو رقم القطعة")} />
                <FilterChips value={pf} onChange={setPf} filters={[
                  { key: "ALL", label: t("All", "الكل"), count: products.data!.length }, { key: "NOPHOTO", label: t("Photo required", "الصورة مطلوبة"), count: products.data!.filter(p => p.hasPhoto === false).length },
                  { key: "VISIBLE", label: t("Customer visible", "ظاهرة للعملاء"), count: products.data!.filter(p => p.customerVisible).length }, { key: "HIDDEN", label: t("Hidden", "مخفية"), count: products.data!.filter(p => p.hidden).length },
                ]} />
                {list.map(p => <ManageRow key={p.id} title={p.name} status={productState(p, t)}
                  leading={p.imageUri ? <Image source={{ uri: p.imageUri }} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: g.cardSoft }} contentFit="cover" /> : <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: g.cardSoft }} />}
                  sub={[ltr(p.partNumber), formatPrice(p.price), `${t("Qty", "الكمية")} ${p.stock}`].join(" · ")} onPress={() => setProductOpen(p)}
                  actions={productActions(t, p, { toggleDetails: () => setProductOpen(p), open: false, reload: () => products.reload() })} />)}
              </View>
            ) : <GText soft style={[gType.caption, align, { paddingVertical: 10 }]}>{t("This shop has no products yet.", "لا توجد منتجات لهذا المتجر بعد.")}</GText>}
          </Block>
        ) : null}
        <Block title={t("Decisions and history", "القرارات والسجل")}>
          <History items={[...a.timeline].reverse().map(e => ({ title: actionLabel(t, e.action), at: fmtTime(e.at), who: e.actor, note: e.details?.message || e.details?.reason ? String(e.details.message ?? e.details.reason) : undefined }))} />
        </Block>
        <ChangesSheet app={a} visible={mode === "changes"} onCancel={() => setMode(null)} onSend={x => guard(() => review.requestChanges(kind, id, x))} />
        <ReasonSheet visible={mode === "reject"} title={t("Reject this application", "رفض هذا الطلب")} prompt={t("Rejection reason. The owner will see it. (required)", "سبب الرفض. سيراه المالك. (مطلوب)")}
          confirmLabel={t("Confirm rejection", "تأكيد الرفض")} danger busy={busy} onCancel={() => setMode(null)} onConfirm={reason => void guard(() => review.reject(kind, id, reason))} />
        <Sheet visible={!!productOpen} onClose={() => setProductOpen(null)} title={productOpen?.name ?? ""} closeLabel={t("Close", "إغلاق")}>
          {productOpen ? <Facts rows={[
            [t("Description", "الوصف"), productOpen.description], [t("Part / OEM number", "رقم القطعة / OEM"), ltr(productOpen.partNumber)],
            [t("Type", "النوع"), productOpen.partType ? (productOpen.partType === "OEM" ? "OEM" : t("Aftermarket", "بديل")) : t("Not specified", "غير محدد")],
            [t("Brand", "الماركة"), productOpen.brand], [t("Price", "السعر"), formatPrice(productOpen.price)], [t("Quantity", "الكمية"), String(productOpen.stock)],
            [t("State", "الحالة"), productState(productOpen, t).label],
          ]} /> : null}
        </Sheet>
      </> : null}
    </Page>
  );
}
