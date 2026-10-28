// Provider applications in /dept (tow companies and parts shops): the New / Needs changes / Approved / Rejected list, the review
// screen (header, location row, documents grid, approval checklist, sticky Approve / Request changes / Reject bar, timeline)
// and the message screens. The server enforces the checklist; the button is only disabled to match it.
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Href, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { cityLabel } from "../../core/constants/cities";
import { useLoad } from "../../core/hooks/useLoad";
import { hapticError, hapticSuccess } from "../../motion";
import { partsAdminService } from "../parts/partsService";
import { Application, Attachment, Doc, Kind, Tab, review } from "../provider/api";
import { ChatScreen } from "../provider/Chat";
import { actionLabel, docLabel, fmtDay, fmtTime, keyLabel, truckTypeLabel } from "../provider/labels";
import { useDocViewer } from "../provider/ui";
import { CATALOG_GROUPS } from "../../core/constants/categories";
import { privateImageSource } from "../shared/api";
import { useDepartment } from "./DepartmentContext";
import { ReviewKind } from "./departments";
import { LocationRow } from "./LocationRow";
import { ProductLine, TruckReview } from "./review";
import { Avatar, Check, CountBadge, DButton, DeptPage, Empty, ItemCard, KV, Load, Panel, Pill, ReasonBox, Section, Sheet, StatusChip, cardStyle, useDT } from "./ui";

const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const kindLabel = (t: (en: string, ar: string) => string, k: Kind) => (k === "TOW" ? t("Tow company", "شركة سحب") : t("Parts shop", "متجر قطع غيار"));

export const AppStatusPill = ({ status }: { status: string }) => <StatusChip status={status} />;

// ---------------------------------------------------------------- list with tabs
export function ApplicationsList({ kind }: { kind: Kind }) {
  const d = useDT();
  const [tab, setTab] = useState<Tab>("NEW");
  const counts = useLoad(() => review.counts(kind), [kind], 15000);
  const list = useLoad(() => review.list(kind, tab), [kind, tab], 15000);
  const tabs: { k: Tab; en: string; ar: string }[] = [
    { k: "NEW", en: "New", ar: "جديد" },
    { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" },
    { k: "APPROVED", en: "Approved", ar: "معتمد" },
    { k: "REJECTED", en: "Rejected", ar: "مرفوض" },
  ];
  return (
    <DeptPage onRefresh={() => (void counts.reload(), void list.reload())} refreshing={list.loading && !!list.data}>
      <Section title={d.t("Applications", "الطلبات")} caption={kindLabel(d.t, kind) + " · " + d.t("review, request changes, approve", "راجع واطلب تعديلات ووافق")} />
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {tabs.map((x) => {
          const on = tab === x.k;
          const n = counts.data?.counts[x.k];
          return (
            <InteractiveButton
              key={x.k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${d.t(x.en, x.ar)}${n !== undefined ? ` ${n}` : ""}`}
              onPress={() => setTab(x.k)}
              style={{ flexDirection: d.row, alignItems: "center", gap: 8, paddingHorizontal: 14, minHeight: 42, borderRadius: 21, borderWidth: 1.5, borderColor: on ? d.fill : d.border, backgroundColor: on ? d.fill : "transparent" }}
            >
              <Text style={{ color: on ? d.fillInk : d.ink, fontSize: 13, fontWeight: "700" }}>{d.t(x.en, x.ar)}</Text>
              <Text style={{ color: on ? d.fillInk : d.muted, fontSize: 13, fontWeight: "800" }}>{n ?? "·"}</Text>
            </InteractiveButton>
          );
        })}
      </View>
      <Load state={list}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty
              icon={tab === "NEW" ? "checkmark-done-outline" : "folder-open-outline"}
              text={tab === "NEW" ? d.t("No application is waiting for review.", "لا يوجد طلب بانتظار المراجعة.") : d.t("Nothing here yet.", "لا يوجد شيء هنا بعد.")}
              hint={tab === "NEW" ? d.t("New applications appear here as soon as an owner submits.", "تظهر الطلبات الجديدة هنا فور إرسالها.") : undefined}
            />
          ) : (
            <>
              {rows.map((r) => (
                <ItemCard key={r.id} label={r.name} onPress={() => go(`/dept/review/${kind === "TOW" ? "company" : "shop"}/${r.id}`)}>
                  <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                    <Avatar name={r.name} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{r.name}</Text>
                      <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{kindLabel(d.t, kind)} · {r.ownerName} · {cityLabel(r.city, d.ar)}</Text>
                    </View>
                    <CountBadge n={r.unreadMessages} />
                  </View>
                  <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    <StatusChip status={r.status} />
                    {r.pendingDocuments ? <Pill tone="amber" icon="document-text-outline" label={`${r.pendingDocuments} ${r.pendingDocuments === 1 ? d.t("document waiting", "مستند بانتظار المراجعة") : d.t("documents waiting", "مستندات بانتظار المراجعة")}`} /> : null}
                    {r.submittedAt ? <Pill icon="calendar-outline" label={fmtDay(r.submittedAt)} /> : null}
                  </View>
                </ItemCard>
              ))}
            </>
          )
        }
      </Load>
    </DeptPage>
  );
}

// ---------------------------------------------------------------- review
const FIELDS: Record<Kind, string[]> = {
  TOW: ["name", "ownerName", "phone", "city", "address", "location", "workingHours", "serviceCities", "truckTypes", "truck"],
  PARTS: ["name", "ownerName", "phone", "city", "address", "location", "workingHours", "categories", "brands"],
};

/** Thumbnail of a private document (image) or an icon (PDF). The file is fetched with the bearer token. */
function DocThumb({ doc }: { doc: Doc }) {
  const d = useDT();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const image = doc.mimeType.startsWith("image/");
  useEffect(() => {
    let alive = true;
    if (image) privateImageSource(doc.uri).then((s) => alive && setSrc(s), () => {});
    return () => {
      alive = false;
    };
  }, [doc.uri, image]);
  return (
    <View style={{ height: 104, borderRadius: 14, overflow: "hidden", backgroundColor: d.chip("neutral").bg, alignItems: "center", justifyContent: "center" }}>
      {src ? <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name={image ? "image-outline" : "document-text-outline"} size={34} color={d.muted} />}
      <View style={{ position: "absolute", bottom: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#000000AA" }}>
        <Ionicons name="expand-outline" size={15} color="#FFF" />
      </View>
    </View>
  );
}

const CATALOG_FLAT = new Map(CATALOG_GROUPS.flatMap((g) => g.categories).map((c) => [c.key, c]));

/** The shop front, large enough to be useful (cover crop, never stretched); tap opens it full screen. Private: fetched with the admin token. */
function StorefrontPhoto({ doc }: { doc: Doc }) {
  const d = useDT();
  const viewer = useDocViewer();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  useEffect(() => {
    let alive = true;
    privateImageSource(doc.uri).then((s) => alive && setSrc(s), () => {});
    return () => {
      alive = false;
    };
  }, [doc.uri]);
  const label = docLabel(d.t, doc.kind);
  return (
    <InteractiveButton accessibilityRole="button" accessibilityLabel={label} onPress={() => viewer.open({ uri: doc.uri, label, mimeType: doc.mimeType })} style={{ marginBottom: 14 }}>
      {viewer.element}
      <View style={{ height: 170, borderRadius: 18, overflow: "hidden", backgroundColor: d.chip("neutral").bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: d.border }}>
        {src ? <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="storefront-outline" size={40} color={d.muted} />}
        <View style={{ position: "absolute", bottom: 8, left: 8, right: 8, flexDirection: d.row }}>
          <Pill icon="storefront-outline" label={label} />
        </View>
      </View>
    </InteractiveButton>
  );
}

function DocTile({ doc, canDecide, onDecide }: { doc: Doc; canDecide: boolean; onDecide: (d: { status: "ACCEPTED" } | { status: "REJECTED"; reason: string }) => Promise<void> }) {
  const d = useDT();
  const viewer = useDocViewer();
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (x: { status: "ACCEPTED" } | { status: "REJECTED"; reason: string }) => {
    setBusy(true);
    try {
      await onDecide(x);
      setRejecting(false);
    } finally {
      setBusy(false);
    }
  };
  const label = docLabel(d.t, doc.kind);
  return (
    <View style={{ ...cardStyle(d, doc.status === "REJECTED" ? "bad" : undefined), width: "48.5%", padding: 10, gap: 8 }}>
      {viewer.element}
      <InteractiveButton accessibilityRole="button" accessibilityLabel={label} onPress={() => viewer.open({ uri: doc.uri, label, mimeType: doc.mimeType })}>
        <DocThumb doc={doc} />
      </InteractiveButton>
      <Text numberOfLines={2} style={{ color: d.ink, fontSize: 13, lineHeight: 19, fontWeight: "800", textAlign: d.align }}>{label}</Text>
      <StatusChip kind="doc" status={doc.status} />
      {doc.expiresAt ? (
        <View style={{ gap: 4, alignItems: d.ar ? "flex-end" : "flex-start" }}>
          <Text style={{ color: d.muted, fontSize: 11, textAlign: d.align }}>{d.t("expires", "ينتهي")} {fmtDay(doc.expiresAt)}</Text>
          <Pill tone={new Date(doc.expiresAt).getTime() < Date.now() ? "bad" : "ok"} icon={new Date(doc.expiresAt).getTime() < Date.now() ? "alert-circle-outline" : "checkmark-circle-outline"} label={new Date(doc.expiresAt).getTime() < Date.now() ? d.t("Expired", "منتهية") : d.t("Valid", "سارية")} />
        </View>
      ) : null}
      {doc.status === "REJECTED" && doc.reason ? <Text style={{ color: d.chip("bad").fg, fontSize: 11.5, lineHeight: 17, textAlign: d.align }}>{doc.reason}</Text> : null}
      {canDecide ? (
        <View style={{ gap: 6 }}>
          {doc.status !== "ACCEPTED" ? <DButton compact variant="success" icon="checkmark" label={d.t("Accept", "قبول")} disabled={busy} onPress={() => run({ status: "ACCEPTED" })} /> : null}
          {doc.status !== "REJECTED" ? <DButton compact variant="danger" label={d.t("Reject", "رفض")} disabled={busy} onPress={() => setRejecting(true)} /> : null}
        </View>
      ) : null}
      <Sheet visible={rejecting} title={d.t("Reject this document", "رفض هذا المستند")} onClose={() => setRejecting(false)}>
        <ReasonBox title={d.t("Why is it rejected? The owner will see this. (required)", "لماذا رُفض؟ سيراه المالك. (مطلوب)")} confirmLabel={d.t("Reject document", "رفض المستند")} busy={busy} onCancel={() => setRejecting(false)} onConfirm={(reason) => run({ status: "REJECTED", reason })} />
      </Sheet>
    </View>
  );
}

function DocGrid({ docs, canDecide, decide }: { docs: Doc[]; canDecide: boolean; decide: (id: string) => (x: { status: "ACCEPTED" } | { status: "REJECTED"; reason: string }) => Promise<void> }) {
  const d = useDT();
  if (!docs.length)
    return (
      <Panel>
        <Text style={{ color: d.muted, fontSize: 13, textAlign: d.align }}>{d.t("No documents uploaded.", "لم يتم رفع مستندات.")}</Text>
      </Panel>
    );
  return (
    <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
      {docs.map((x) => (
        <DocTile key={x.id} doc={x} canDecide={canDecide} onDecide={decide(x.id)} />
      ))}
    </View>
  );
}

function ChangesPanel({ app, onSend, onCancel }: { app: Application; onSend: (d: { message: string; fields: string[]; documentIds: string[] }) => Promise<void>; onCancel: () => void }) {
  const d = useDT();
  const [fields, setFields] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const all = [...app.documents, ...app.trucks.flatMap((t) => t.documents)];
  const chip = (key: string, label: string, on: boolean, press: () => void) => (
    <InteractiveButton key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={press} style={{ paddingHorizontal: 12, minHeight: 38, borderRadius: 19, borderWidth: 1.5, alignItems: "center", justifyContent: "center", borderColor: on ? d.chip("amber").fg : d.border, backgroundColor: on ? d.chip("amber").bg : "transparent" }}>
      <Text style={{ color: on ? d.chip("amber").fg : d.ink, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </InteractiveButton>
  );
  async function send() {
    if (!message.trim()) return setError(d.t("A message is required.", "الرسالة مطلوبة."));
    if (!fields.length && !docs.length) return setError(d.t("Select at least one field or document.", "اختر حقلًا أو مستندًا واحدًا على الأقل."));
    setBusy(true);
    setError("");
    try {
      await onSend({ message: message.trim(), fields, documentIds: docs });
    } catch (e) {
      setError(e instanceof Error ? e.message : d.t("Could not send.", "تعذّر الإرسال."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: d.ink, fontSize: 13, fontWeight: "700", textAlign: d.align }}>{d.t("Fields to fix", "الحقول المطلوب تصحيحها")}</Text>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8 }}>{FIELDS[app.kind].map((k) => chip(k, keyLabel(d.t, k), fields.includes(k), () => setFields(toggle(fields, k))))}</View>
      <Text style={{ color: d.ink, fontSize: 13, fontWeight: "700", textAlign: d.align }}>{d.t("Documents to replace", "المستندات المطلوب استبدالها")}</Text>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8 }}>{all.map((x) => chip(x.id, docLabel(d.t, x.kind), docs.includes(x.id), () => setDocs(toggle(docs, x.id))))}</View>
      <Text style={{ color: d.ink, fontSize: 13, fontWeight: "700", textAlign: d.align }}>{d.t("Message to the owner (required)", "رسالة إلى المالك (مطلوبة)")}</Text>
      <TextInput multiline maxLength={1000} value={message} onChangeText={setMessage} placeholderTextColor={d.muted} style={{ minHeight: 90, borderRadius: 16, borderWidth: 1, borderColor: d.border, color: d.ink, padding: 12, textAlignVertical: "top", textAlign: d.align, backgroundColor: d.dark ? "#241B15" : "#FFFFFF" }} />
      {error ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, textAlign: d.align }}>{error}</Text> : null}
      <DButton variant="warn" label={d.t("Send and request changes", "إرسال وطلب التعديلات")} icon="send-outline" disabled={busy} onPress={send} />
      <DButton label={d.t("Cancel", "إلغاء")} variant="ghost" onPress={onCancel} />
    </View>
  );
}

export function ApplicationReview({ kind, id }: { kind: Kind; id: string }) {
  const d = useDT();
  const state = useLoad(() => review.get(kind, id), [kind, id], 15000);
  const products = useLoad(async () => (kind === "PARTS" && state.data?.status === "APPROVED" ? (await partsAdminService.getShop(NOACTOR, id)).products : []), [kind, id, state.data?.status]);
  const [mode, setMode] = useState<null | "changes" | "reject">(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const guard = async (work: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await work();
      hapticSuccess();
      setMode(null);
      await state.reload();
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : d.t("Something went wrong.", "حدث خطأ ما."));
    } finally {
      setBusy(false);
    }
  };

  const app = state.data;
  const reviewing = app?.status === "PENDING";
  const items = app?.checklist ?? [];
  const allOk = items.length > 0 && items.every((c) => c.ok);

  const footer = app && reviewing ? (
    <View style={{ gap: 8 }}>
      {!allOk ? <Text style={{ color: d.chip("amber").fg, fontSize: 12, lineHeight: 18, fontWeight: "600", textAlign: "center" }}>{d.t("Accept every required document to enable Approve.", "اقبل كل المستندات المطلوبة لتفعيل الموافقة.")}</Text> : null}
      <DButton variant="success" icon="checkmark-circle" label={d.t("Approve", "موافقة")} disabled={busy || !allOk} onPress={() => guard(() => review.approve(kind, id))} />
      <View style={{ flexDirection: d.row, gap: 8 }}>
        <View style={{ flex: 1 }}><DButton variant="warn" compact icon="create-outline" label={d.t("Request changes", "طلب تعديلات")} disabled={busy} onPress={() => setMode("changes")} /></View>
        <View style={{ flex: 1 }}><DButton variant="danger" compact icon="close" label={d.t("Reject", "رفض")} disabled={busy} onPress={() => setMode("reject")} /></View>
      </View>
    </View>
  ) : undefined;

  return (
    <DeptPage back tabs={false} footer={footer} onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
      <Load state={state}>
        {(a: Application) => {
          const i = a.info;
          const decide = (docId: string) => (x: { status: "ACCEPTED" } | { status: "REJECTED"; reason: string }) => review.decideDoc(kind, id, docId, x).then(() => state.reload()).then(() => undefined);
          const flaggedFields = a.flaggedFields.filter((k) => !k.startsWith("doc:"));
          return (
            <>
              <Panel>
                <View style={{ flexDirection: d.row, alignItems: "center", gap: 14 }}>
                  <Avatar name={i.name ?? "?"} size={56} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ color: d.ink, fontSize: 20, lineHeight: 28, fontWeight: "800", textAlign: d.align }}>{i.name}</Text>
                    <Text style={{ color: d.muted, fontSize: 12.5, lineHeight: 19, textAlign: d.align }}>{kindLabel(d.t, kind)} · {a.owner.fullName}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <StatusChip status={a.status} size="l" />
                  {a.submittedAt ? <Pill icon="calendar-outline" label={`${d.t("Submitted", "أُرسل")} ${fmtDay(a.submittedAt)}`} /> : null}
                  {a.submissionVersion > 1 ? <Pill tone="bronze" label={`${d.t("Submission", "الإرسال")} ${a.submissionVersion}`} /> : null}
                </View>
                <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align, marginTop: 6 }}>{a.owner.email}</Text>
              </Panel>
              {error ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 13, lineHeight: 20, marginBottom: 10, textAlign: d.align }}>{error}</Text> : null}

              <InteractiveButton accessibilityRole="button" onPress={() => go(`/dept/thread/${kind}/${id}`)} style={{ ...cardStyle(d), flexDirection: d.row, alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 16, marginBottom: 14 }}>
                <Ionicons name="chatbubbles-outline" size={22} color={d.accent} />
                <Text style={{ flex: 1, color: d.ink, fontSize: 14, fontWeight: "700", textAlign: d.align }}>{d.t("Messages with the owner", "الرسائل مع المالك")}</Text>
                <CountBadge n={a.unreadMessages} />
                <Ionicons name={d.ar ? "chevron-back" : "chevron-forward"} size={18} color={d.accent} />
              </InteractiveButton>

              {kind === "PARTS" && a.documents.some((x) => x.kind === "STOREFRONT_PHOTO" && x.mimeType.startsWith("image/")) ? <StorefrontPhoto doc={a.documents.find((x) => x.kind === "STOREFRONT_PHOTO")!} /> : null}

              <Section title={d.t("Business", "النشاط")} />
              <Panel>
                <KV k={d.t("Arabic name", "الاسم بالعربية")} v={i.nameAr} />
                <KV k={d.t("Owner", "المالك")} v={i.ownerName} />
                <KV k={d.t("Phone", "الهاتف")} v={i.phone ? "⁦" + i.phone + "⁩" : ""} />
                <KV k={d.t("City", "المدينة")} v={i.city ? cityLabel(i.city, d.ar) : ""} />
                <KV k={d.t("Address", "العنوان")} v={i.address} />
                <KV k={d.t("Working hours", "ساعات العمل")} v={i.open24h ? d.t("Open 24/7", "على مدار الساعة") : i.workingHours} />
                {kind === "TOW" ? (
                  <>
                    <KV k={d.t("Coverage", "التغطية")} v={(i.serviceCities ?? []).map((c: string) => cityLabel(c, d.ar)).join(d.ar ? "، " : ", ")} />
                    <KV k={d.t("Truck types", "أنواع الشاحنات")} v={(i.truckTypes ?? []).map((k: string) => truckTypeLabel(d.t, k)).join(d.ar ? "، " : ", ")} />
                    <KV k={d.t("Trucks claimed", "عدد الشاحنات المعلن")} v={i.truckCountClaimed} />
                  </>
                ) : (
                  <>
                    <KV k={d.t("Categories", "الفئات")} v={(i.categories ?? []).map((k: string) => { const c = CATALOG_FLAT.get(k); return c ? (d.ar ? c.ar : c.en) : ""; }).filter(Boolean).join(d.ar ? "، " : ", ")} />
                    <KV k={d.t("Main brands", "العلامات التجارية")} v={(i.brands ?? []).join(", ")} />
                    <KV k={d.t("Brand / company", "العلامة / الشركة")} v={i.brandName} />
                    <KV k={d.t("Branch", "الفرع")} v={i.branchName} />
                  </>
                )}
                {flaggedFields.length ? (
                  <View style={{ flexDirection: d.row, gap: 8, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: d.chip("amber").border, backgroundColor: d.chip("amber").bg, marginTop: 6 }}>
                    <Ionicons name="flag" size={16} color={d.chip("amber").fg} />
                    <Text style={{ flex: 1, color: d.chip("amber").fg, fontSize: 12, lineHeight: 19, fontWeight: "700", textAlign: d.align }}>{d.t("Flagged: ", "محدد للتصحيح: ")}{flaggedFields.map((k) => keyLabel(d.t, k)).join(d.ar ? "، " : ", ")}</Text>
                  </View>
                ) : null}
              </Panel>
              <LocationRow
                point={i.baseLat != null && i.baseLng != null ? { lat: i.baseLat, lng: i.baseLng } : null}
                city={i.city}
                address={i.address}
                buttonLabel={d.t("View on map", "عرض على الخريطة")}
                emptyLabel={d.t("The owner has not set a location yet.", "لم يحدد المالك موقعًا بعد.")}
                onPress={() => go(`/dept/map?lat=${i.baseLat}&lng=${i.baseLng}&name=${encodeURIComponent(i.name ?? "")}`)}
              />
              <View style={{ height: 14 }} />

              <Section title={d.t("Documents", "المستندات")} caption={d.t("Tap a thumbnail to open it full screen. Private: only the owner and this department can see it.", "المس الصورة المصغرة لفتحها بملء الشاشة. خاصة: لا يراها إلا المالك وهذا القسم.")} />
              <DocGrid docs={a.documents} canDecide={!!reviewing} decide={decide} />
              {a.trucks.map((t) => (
                <View key={t.id}>
                  <Section title={`${truckTypeLabel(d.t, t.type)} · ${"⁦" + t.plate + "⁩"}`} caption={[t.make, t.model, t.year].filter(Boolean).join(" ")} />
                  {t.baseLat != null && t.baseLng != null ? (
                    <View style={{ marginBottom: 10 }}>
                      <LocationRow point={{ lat: t.baseLat, lng: t.baseLng }} address={t.locationAddress} buttonLabel={d.t("View truck location", "عرض موقع الشاحنة")} onPress={() => go(`/dept/map?lat=${t.baseLat}&lng=${t.baseLng}&name=${encodeURIComponent(t.plate)}`)} />
                    </View>
                  ) : null}
                  <DocGrid docs={t.documents} canDecide={!!reviewing} decide={decide} />
                </View>
              ))}

              <Section title={d.t("Approval checklist", "قائمة التحقق")} caption={d.t("Every item must pass. The server checks this again.", "يجب اجتياز كل البنود. يتحقق الخادم من ذلك مجددًا.")} />
              <Panel>
                {items.map((c) => (
                  <Check
                    key={c.key}
                    ok={c.ok}
                    label={keyLabel(d.t, c.key)}
                    hint={c.ok ? undefined : c.key === "truck" ? d.t(`${c.detail ?? "0/0"} trucks have an accepted photo, registration and insurance or operating licence`, `${c.detail ?? "0/0"} شاحنات لديها صورة وترخيص وتأمين أو رخصة تشغيل مقبولة`) : c.key.startsWith("doc:") ? (c.detail === "MISSING" ? d.t("Not uploaded", "لم يُرفع") : c.detail === "REJECTED" ? d.t("Rejected", "مرفوض") : d.t("Waiting for your review", "بانتظار مراجعتك")) : undefined}
                  />
                ))}
              </Panel>

              {a.status === "REJECTED" && a.rejectionReason ? (
                <Panel tone="bad" title={d.t("Rejection reason", "سبب الرفض")} icon="close-circle-outline">
                  <Text style={{ color: d.ink, fontSize: 13, lineHeight: 21, textAlign: d.align }}>{a.rejectionReason}</Text>
                </Panel>
              ) : null}

              {kind === "TOW" && a.trucks.length ? (
                <>
                  <Section title={d.t("Trucks", "الشاحنات")} />
                  {a.trucks.map((t) => (
                    <ItemCard key={t.id} label={t.plate} onPress={() => go(`/dept/review/truck/${t.id}`)}>
                      <View style={{ flexDirection: d.row, alignItems: "center", gap: 10 }}>
                        <Ionicons name="car-sport-outline" size={24} color={d.accent} />
                        <Text numberOfLines={1} style={{ flex: 1, color: d.ink, fontSize: 14, fontWeight: "700", textAlign: d.align }}>{truckTypeLabel(d.t, t.type)} · {"⁦" + t.plate + "⁩"}</Text>
                        <StatusChip status={t.verification} />
                      </View>
                    </ItemCard>
                  ))}
                </>
              ) : null}

              {kind === "PARTS" && a.status === "APPROVED" ? (
                <>
                  <Section title={`${d.t("Products", "المنتجات")} (${products.data?.length ?? 0})`} caption={d.t("You can hide or show a product. You cannot edit it.", "يمكنك إخفاء المنتج أو إظهاره دون تعديله.")} />
                  {(products.data ?? []).length === 0 ? <Empty icon="cube-outline" text={d.t("This shop has no products yet.", "لا توجد منتجات لهذا المتجر بعد.")} /> : null}
                  {(products.data ?? []).map((p) => (
                    <ProductLine key={p.id} product={p} onDone={() => void products.reload()} />
                  ))}
                </>
              ) : null}

              <Section title={d.t("Decisions and history", "القرارات والسجل")} />
              <Panel>
                {[...a.timeline].reverse().map((e, n) => (
                  <View key={n} style={{ paddingVertical: 8, borderTopWidth: n ? 1 : 0, borderTopColor: d.border }}>
                    <View style={{ flexDirection: d.row, justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ flex: 1, color: d.ink, fontSize: 13, fontWeight: "700", textAlign: d.align }}>{actionLabel(d.t, e.action)}</Text>
                      <Text style={{ color: d.muted, fontSize: 11 }}>{fmtTime(e.at)}</Text>
                    </View>
                    <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>{e.actor}</Text>
                    {e.details?.message || e.details?.reason ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{String(e.details.message ?? e.details.reason)}</Text> : null}
                  </View>
                ))}
              </Panel>

              <Sheet visible={mode === "changes"} title={d.t("Request changes", "طلب تعديلات")} onClose={() => setMode(null)}>
                <ChangesPanel app={a} onCancel={() => setMode(null)} onSend={(x) => guard(() => review.requestChanges(kind, id, x))} />
              </Sheet>
              <Sheet visible={mode === "reject"} title={d.t("Reject this application", "رفض هذا الطلب")} onClose={() => setMode(null)}>
                <ReasonBox title={d.t("Rejection reason. The owner will see it. (required)", "سبب الرفض. سيراه المالك. (مطلوب)")} confirmLabel={d.t("Confirm rejection", "تأكيد الرفض")} busy={busy} onCancel={() => setMode(null)} onConfirm={(reason) => guard(() => review.reject(kind, id, reason))} />
              </Sheet>
            </>
          );
        }}
      </Load>
    </DeptPage>
  );
}

// ---------------------------------------------------------------- messages
/** The Messages tab: one row per application that has a thread. */
export function DeptMessages() {
  const { active } = useDepartment();
  const d = useDT();
  const kind = active.provider;
  const state = useLoad(async () => (kind ? review.threads(kind) : []), [kind], 15000);
  return (
    <DeptPage onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
      <Section title={d.t("Messages", "الرسائل")} caption={d.t(active.en, active.ar)} />
      {!kind ? (
        <Empty icon="chatbubbles-outline" text={d.t("Mechanic applications are handled in the Requests tab.", "تُعالج طلبات الميكانيكيين في تبويب الطلبات.")} />
      ) : (
        <Load state={state}>
          {(threads) =>
            threads.length === 0 ? (
              <Empty icon="chatbubbles-outline" text={d.t("No conversations yet.", "لا توجد محادثات بعد.")} hint={d.t("A conversation starts when an owner submits or writes to you.", "تبدأ المحادثة عند إرسال المالك طلبه أو مراسلتك.")} />
            ) : (
              <>
                {threads.map((t) => {
                  const preview = (t.last.split("||")[d.ar && t.last.includes("||") ? 1 : 0] ?? "").trim();
                  return (
                    <ItemCard key={t.id} label={t.name} onPress={() => go(`/dept/thread/${kind}/${t.id}`)}>
                      <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                        <Avatar name={t.name} />
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <View style={{ flexDirection: d.row, alignItems: "center", gap: 8 }}>
                            <Text numberOfLines={1} style={{ flex: 1, color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: t.unread ? "800" : "700", textAlign: d.align }}>{t.name}</Text>
                            {t.at ? <Text style={{ color: d.muted, fontSize: 11 }}>{fmtTime(t.at)}</Text> : null}
                          </View>
                          <Text numberOfLines={1} style={{ color: t.unread ? d.ink : d.muted, fontSize: 12.5, lineHeight: 19, fontWeight: t.unread ? "700" : "400", textAlign: d.align }}>{t.lastFrom === "ADMIN" ? d.t("You: ", "أنت: ") : ""}{preview}</Text>
                          <View style={{ flexDirection: d.row, alignItems: "center", gap: 8, marginTop: 4 }}>
                            <Text style={{ color: d.muted, fontSize: 11.5 }}>{kindLabel(d.t, kind)}</Text>
                            <StatusChip status={t.status} />
                          </View>
                        </View>
                        <CountBadge n={t.unread} />
                      </View>
                    </ItemCard>
                  );
                })}
              </>
            )
          }
        </Load>
      )}
    </DeptPage>
  );
}

/** One thread with an applicant, from the department side (full screen chat). */
export function DeptThread({ kind, id }: { kind: Kind; id: string }) {
  const d = useDT();
  const app = useLoad(() => review.get(kind, id), [kind, id]);
  const load = useCallback(() => review.messages(kind, id), [kind, id]);
  const markRead = useCallback(() => review.markRead(kind, id), [kind, id]);
  const send = useCallback((b: string, a?: Attachment) => review.send(kind, id, b, a), [kind, id]);
  const name = app.data?.info.name ?? d.t("Messages", "الرسائل");
  return (
    <ChatScreen
      title={name}
      subtitle={app.data ? `${app.data.owner.fullName} · ${kindLabel(d.t, kind)}` : undefined}
      badge={app.data ? <StatusChip status={app.data.status} /> : undefined}
      mine="ADMIN"
      names={{ me: "MOTEXA", other: app.data?.owner.fullName ?? name }}
      load={load}
      markRead={markRead}
      send={send}
    />
  );
}

/** The one review route. company / shop = application review; truck = the vehicle; mechanics have no screen of ours (Diala's review screen is the Requests tab). */
export function ReviewScreen({ kind, id }: { kind: ReviewKind; id: string }) {
  useEffect(() => {
    if (kind === "mechanic") router.replace("/dept/requests" as Href);
  }, [kind]);
  if (kind === "company") return <ApplicationReview kind="TOW" id={id} />;
  if (kind === "shop") return <ApplicationReview kind="PARTS" id={id} />;
  if (kind === "truck") return <TruckReview id={id} />;
  return null;
}
