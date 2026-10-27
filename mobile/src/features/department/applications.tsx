// Provider applications in /dept (tow companies and parts shops): the New / Needs changes / Approved / Rejected list, the review
// screen (business info, map pin, documents with per-document decisions, approval checklist, Approve / Request changes / Reject,
// timeline) and the message threads. The server enforces the checklist; the button is only disabled to match it.
import { Ionicons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { cityLabel } from "../../core/constants/cities";
import { useLoad } from "../../core/hooks/useLoad";
import { hapticError, hapticSuccess } from "../../motion";
import { partsAdminService } from "../parts/partsService";
import { Application, Doc, Kind, Tab, review } from "../provider/api";
import { actionLabel, appStatusLabel, docLabel, docStatusLabel, fmtDay, fmtTime, keyLabel, truckTypeLabel } from "../provider/labels";
import { ThreadView } from "../provider/Thread";
import { useDocViewer } from "../provider/ui";
import { MAPS_AVAILABLE, PinMap } from "../shared/maps";
import { useDepartment } from "./DepartmentContext";
import { Check, DButton, DeptPage, Empty, ItemCard, KV, Load, Panel, Pill, ReasonBox, Section, useDT } from "./ui";
import { ReviewKind } from "./departments";
import { ProductLine, TruckReview } from "./review";

const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const tone = (s: string) => (s === "APPROVED" || s === "ACCEPTED" ? "ok" : s === "REJECTED" ? "bad" : s === "NEEDS_CHANGES" ? "warn" : s === "PENDING" ? "warn" : "neutral");

export const AppStatusPill = ({ status }: { status: string }) => {
  const d = useDT();
  return <Pill tone={tone(status) as any} label={appStatusLabel(d.t, status)} />;
};

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
      <Section title={d.t("Applications", "الطلبات")} caption={kind === "TOW" ? d.t("Tow companies", "شركات السحب") : d.t("Parts shops", "متاجر قطع الغيار")} />
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
              style={{ flexDirection: d.row, alignItems: "center", gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: on ? "#E0A36F" : d.border, backgroundColor: on ? "#E0A36F" : "transparent" }}
            >
              <Text style={{ color: on ? "#332218" : d.ink, fontSize: 13, fontWeight: "600" }}>{d.t(x.en, x.ar)}</Text>
              <Text style={{ color: on ? "#332218" : d.muted, fontSize: 13, fontWeight: "700" }}>{n ?? "·"}</Text>
            </InteractiveButton>
          );
        })}
      </View>
      <Load state={list}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty icon="checkmark-done-outline" text={tab === "NEW" ? d.t("No application is waiting for review.", "لا يوجد طلب بانتظار المراجعة.") : d.t("Nothing here.", "لا يوجد شيء هنا.")} />
          ) : (
            <>
              {rows.map((r) => (
                <ItemCard key={r.id} label={r.name} onPress={() => go(`/dept/review/${kind === "TOW" ? "company" : "shop"}/${r.id}`)}>
                  <Text numberOfLines={2} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "600", textAlign: d.align }}>{r.name}</Text>
                  <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{[r.ownerName, cityLabel(r.city, d.ar)].filter(Boolean).join(" · ")}</Text>
                  <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    <AppStatusPill status={r.status} />
                    {r.submittedAt ? <Pill label={`${d.t("Submitted", "أُرسل")} ${fmtDay(r.submittedAt)}`} /> : null}
                    {r.pendingDocuments ? <Pill tone="warn" label={`${r.pendingDocuments} ${d.t("documents waiting", "مستندات بانتظار المراجعة")}`} /> : null}
                    {r.unreadMessages ? <Pill tone="warn" icon="chatbubble-ellipses-outline" label={`${r.unreadMessages} ${d.t("new messages", "رسائل جديدة")}`} /> : null}
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

function DocRow({ doc, canDecide, onDecide }: { doc: Doc; canDecide: boolean; onDecide: (d: { status: "ACCEPTED" } | { status: "REJECTED"; reason: string }) => Promise<void> }) {
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
  return (
    <View style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: d.border, gap: 8 }}>
      {viewer.element}
      <InteractiveButton
        accessibilityRole="button"
        accessibilityLabel={docLabel(d.t, doc.kind)}
        onPress={() => viewer.open({ uri: doc.uri, label: docLabel(d.t, doc.kind), mimeType: doc.mimeType })}
        style={{ flexDirection: d.row, alignItems: "center", gap: 10 }}
      >
        <Ionicons name={doc.mimeType === "application/pdf" ? "document-text-outline" : "image-outline"} size={22} color={d.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: d.ink, fontSize: 14, fontWeight: "600", textAlign: d.align }}>{docLabel(d.t, doc.kind)}</Text>
          <Text numberOfLines={1} style={{ color: d.muted, fontSize: 11, textAlign: d.align }}>{doc.fileName}{doc.expiresAt ? ` · ${d.t("expires", "ينتهي")} ${fmtDay(doc.expiresAt)}` : ""}</Text>
        </View>
        <Pill tone={tone(doc.status) as any} label={docStatusLabel(d.t, doc.status)} />
        <Ionicons name="expand-outline" size={18} color={d.muted} />
      </InteractiveButton>
      {doc.status === "REJECTED" && doc.reason ? <Text style={{ color: d.bad, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{doc.reason}</Text> : null}
      {canDecide && !rejecting ? (
        <View style={{ flexDirection: d.row, gap: 8 }}>
          {doc.status !== "ACCEPTED" ? <View style={{ flex: 1 }}><DButton label={d.t("Accept", "قبول")} icon="checkmark" disabled={busy} onPress={() => run({ status: "ACCEPTED" })} /></View> : null}
          {doc.status !== "REJECTED" ? <View style={{ flex: 1 }}><DButton label={d.t("Reject", "رفض")} variant="danger" disabled={busy} onPress={() => setRejecting(true)} /></View> : null}
        </View>
      ) : null}
      {rejecting ? <ReasonBox title={d.t("Why is this document rejected? (required)", "لماذا رُفض هذا المستند؟ (مطلوب)")} confirmLabel={d.t("Reject document", "رفض المستند")} busy={busy} onCancel={() => setRejecting(false)} onConfirm={(reason) => run({ status: "REJECTED", reason })} /> : null}
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
    <InteractiveButton key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={press} style={{ paddingHorizontal: 12, minHeight: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: on ? "#E0A36F" : d.border, backgroundColor: on ? "#E0A36F" : "transparent" }}>
      <Text style={{ color: on ? "#332218" : d.ink, fontSize: 12, fontWeight: "600" }}>{label}</Text>
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
      <Text style={{ color: d.ink, fontSize: 13, fontWeight: "600", textAlign: d.align }}>{d.t("Fields to fix", "الحقول المطلوب تصحيحها")}</Text>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8 }}>{FIELDS[app.kind].map((k) => chip(k, keyLabel(d.t, k), fields.includes(k), () => setFields(toggle(fields, k))))}</View>
      <Text style={{ color: d.ink, fontSize: 13, fontWeight: "600", textAlign: d.align }}>{d.t("Documents to replace", "المستندات المطلوب استبدالها")}</Text>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8 }}>{all.map((x) => chip(x.id, docLabel(d.t, x.kind), docs.includes(x.id), () => setDocs(toggle(docs, x.id))))}</View>
      <Text style={{ color: d.ink, fontSize: 13, fontWeight: "600", textAlign: d.align }}>{d.t("Message to the owner (required)", "رسالة إلى المالك (مطلوبة)")}</Text>
      <TextInput multiline maxLength={1000} value={message} onChangeText={setMessage} placeholderTextColor={d.muted} style={{ minHeight: 84, borderRadius: 16, borderWidth: 1, borderColor: d.border, color: d.ink, padding: 12, textAlignVertical: "top", textAlign: d.align, backgroundColor: d.dark ? "#2C2119" : "#FFFDF8" }} />
      {error ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, textAlign: d.align }}>{error}</Text> : null}
      <DButton label={d.t("Send and request changes", "إرسال وطلب التعديلات")} icon="send-outline" disabled={busy} onPress={send} />
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

  return (
    <DeptPage back tabs={false} onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
      <Load state={state}>
        {(app: Application) => {
          const reviewing = app.status === "PENDING";
          const items = app.checklist ?? [];
          const allOk = items.length > 0 && items.every((c) => c.ok);
          const i = app.info;
          const decide = (docId: string) => (x: { status: "ACCEPTED" } | { status: "REJECTED"; reason: string }) => review.decideDoc(kind, id, docId, x).then(() => state.reload()).then(() => undefined);
          return (
            <>
              <View style={{ marginBottom: 14, gap: 8 }}>
                <Text style={{ color: d.ink, fontSize: 22, lineHeight: 31, fontWeight: "600", textAlign: d.align }}>{i.name}</Text>
                <Text style={{ color: d.muted, fontSize: 13, textAlign: d.align }}>{app.owner.fullName} · {app.owner.email}</Text>
                <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6 }}>
                  <AppStatusPill status={app.status} />
                  {app.submissionVersion > 1 ? <Pill label={`${d.t("Submission", "الإرسال")} ${app.submissionVersion}`} /> : null}
                </View>
              </View>
              {error ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 13, lineHeight: 20, marginBottom: 10, textAlign: d.align }}>{error}</Text> : null}

              <InteractiveButton accessibilityRole="button" onPress={() => go(`/dept/thread/${kind}/${id}`)} style={{ flexDirection: d.row, alignItems: "center", gap: 10, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: d.border, paddingHorizontal: 16, marginBottom: 14, backgroundColor: d.surface }}>
                <Ionicons name="chatbubbles-outline" size={20} color={d.accent} />
                <Text style={{ flex: 1, color: d.ink, fontSize: 14, fontWeight: "600", textAlign: d.align }}>{d.t("Messages with the owner", "الرسائل مع المالك")}</Text>
                {app.unreadMessages ? <Pill tone="warn" label={String(app.unreadMessages)} /> : null}
                <Ionicons name={d.ar ? "chevron-back" : "chevron-forward"} size={18} color={d.accent} />
              </InteractiveButton>

              <Section title={d.t("Business", "النشاط")} />
              <Panel>
                <KV k={d.t("Name", "الاسم")} v={i.name} />
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
                    <KV k={d.t("Categories", "الفئات")} v={(i.categories ?? []).length ? String(i.categories.length) : ""} />
                    <KV k={d.t("Main brands", "العلامات التجارية")} v={(i.brands ?? []).join(", ")} />
                  </>
                )}
                {app.flaggedFields.filter((k) => !k.startsWith("doc:")).length ? (
                  <Text style={{ color: d.warn, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{d.t("Flagged: ", "محدد للتصحيح: ")}{app.flaggedFields.filter((k) => !k.startsWith("doc:")).map((k) => keyLabel(d.t, k)).join(d.ar ? "، " : ", ")}</Text>
                ) : null}
              </Panel>
              {MAPS_AVAILABLE && i.baseLat != null && i.baseLng != null ? (
                <View style={{ marginBottom: 14, borderRadius: 20, overflow: "hidden" }}>
                  <PinMap point={{ lat: i.baseLat, lng: i.baseLng }} height={180} />
                </View>
              ) : null}

              <Section title={d.t("Documents", "المستندات")} caption={d.t("Tap a document to open it. Private: only the owner and this department can see it.", "المس المستند لفتحه. خاص: لا يراه إلا المالك وهذا القسم.")} />
              <Panel>
                {app.documents.length === 0 ? <Text style={{ color: d.muted, fontSize: 13, textAlign: d.align }}>{d.t("No documents uploaded.", "لم يتم رفع مستندات.")}</Text> : null}
                {app.documents.map((x) => (
                  <DocRow key={x.id} doc={x} canDecide={reviewing} onDecide={decide(x.id)} />
                ))}
              </Panel>
              {app.trucks.map((t) => (
                <View key={t.id}>
                  <Section title={`${truckTypeLabel(d.t, t.type)} · ${"⁦" + t.plate + "⁩"}`} caption={[t.make, t.model, t.year].filter(Boolean).join(" ")} />
                  <Panel>
                    {t.documents.length === 0 ? <Text style={{ color: d.muted, fontSize: 13, textAlign: d.align }}>{d.t("No documents uploaded.", "لم يتم رفع مستندات.")}</Text> : null}
                    {t.documents.map((x) => (
                      <DocRow key={x.id} doc={x} canDecide={reviewing} onDecide={decide(x.id)} />
                    ))}
                  </Panel>
                </View>
              ))}

              <Section title={d.t("Approval checklist", "قائمة التحقق")} caption={d.t("All items must pass before approval. The server checks this again.", "يجب اجتياز كل البنود قبل الموافقة. يتحقق الخادم من ذلك مجددًا.")} />
              <Panel>
                {items.map((c) => (
                  <Check
                    key={c.key}
                    ok={c.ok}
                    label={keyLabel(d.t, c.key)}
                    hint={c.ok ? undefined : c.key === "truck" ? d.t(`${c.detail ?? "0/0"} trucks have an accepted photo, licence and insurance`, `${c.detail ?? "0/0"} شاحنات لديها صورة ورخصة وتأمين مقبولة`) : c.key.startsWith("doc:") ? (c.detail === "MISSING" ? d.t("Not uploaded", "لم يُرفع") : docStatusLabel(d.t, c.detail ?? "PENDING")) : undefined}
                  />
                ))}
              </Panel>

              {reviewing ? (
                <>
                  <Section title={d.t("Decision", "القرار")} />
                  <Panel>
                    {mode === null ? (
                      <View style={{ gap: 8 }}>
                        <DButton label={d.t("Approve", "موافقة")} icon="checkmark-circle-outline" disabled={busy || !allOk} onPress={() => guard(() => review.approve(kind, id))} />
                        {!allOk ? <Text style={{ color: d.warn, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{d.t("Accept every required document and complete the checklist to approve.", "اقبل كل المستندات المطلوبة وأكمل القائمة للموافقة.")}</Text> : null}
                        <DButton label={d.t("Request changes", "طلب تعديلات")} icon="create-outline" variant="ghost" disabled={busy} onPress={() => setMode("changes")} />
                        <DButton label={d.t("Reject", "رفض")} variant="danger" disabled={busy} onPress={() => setMode("reject")} />
                      </View>
                    ) : mode === "changes" ? (
                      <ChangesPanel app={app} onCancel={() => setMode(null)} onSend={(x) => guard(() => review.requestChanges(kind, id, x))} />
                    ) : (
                      <ReasonBox title={d.t("Rejection reason (required)", "سبب الرفض (مطلوب)")} confirmLabel={d.t("Confirm rejection", "تأكيد الرفض")} busy={busy} onCancel={() => setMode(null)} onConfirm={(reason) => guard(() => review.reject(kind, id, reason))} />
                    )}
                  </Panel>
                </>
              ) : app.status === "REJECTED" && app.rejectionReason ? (
                <Panel tone="bad"><Text style={{ color: d.bad, fontSize: 13, lineHeight: 21, textAlign: d.align }}>{app.rejectionReason}</Text></Panel>
              ) : null}

              {kind === "TOW" && app.trucks.length ? (
                <>
                  <Section title={d.t("Trucks", "الشاحنات")} />
                  {app.trucks.map((t) => (
                    <ItemCard key={t.id} label={t.plate} onPress={() => go(`/dept/review/truck/${t.id}`)}>
                      <Text numberOfLines={1} style={{ color: d.ink, fontSize: 14, fontWeight: "600", textAlign: d.align }}>{truckTypeLabel(d.t, t.type)} · {"⁦" + t.plate + "⁩"}</Text>
                      <View style={{ marginTop: 6 }}><AppStatusPill status={t.verification} /></View>
                    </ItemCard>
                  ))}
                </>
              ) : null}

              {kind === "PARTS" && app.status === "APPROVED" ? (
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
                {[...app.timeline].reverse().map((e, n) => (
                  <View key={n} style={{ paddingVertical: 8, borderTopWidth: n ? 1 : 0, borderTopColor: d.border }}>
                    <View style={{ flexDirection: d.row, justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ flex: 1, color: d.ink, fontSize: 13, fontWeight: "600", textAlign: d.align }}>{actionLabel(d.t, e.action)}</Text>
                      <Text style={{ color: d.muted, fontSize: 11 }}>{fmtTime(e.at)}</Text>
                    </View>
                    <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>{e.actor}</Text>
                    {e.details?.message || e.details?.reason ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{String(e.details.message ?? e.details.reason)}</Text> : null}
                  </View>
                ))}
              </Panel>
            </>
          );
        }}
      </Load>
    </DeptPage>
  );
}

// ---------------------------------------------------------------- messages
/** The Messages tab: one row per application that has a thread, with an unread badge. */
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
              <Empty icon="chatbubbles-outline" text={d.t("No conversations yet.", "لا توجد محادثات بعد.")} />
            ) : (
              <>
                {threads.map((t) => (
                  <ItemCard key={t.id} label={t.name} onPress={() => go(`/dept/thread/${kind}/${t.id}`)}>
                    <View style={{ flexDirection: d.row, alignItems: "center", gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, color: d.ink, fontSize: 15, fontWeight: "600", textAlign: d.align }}>{t.name}</Text>
                      {t.unread ? <Pill tone="warn" label={String(t.unread)} /> : null}
                    </View>
                    <Text numberOfLines={2} style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{t.last.split("||")[d.ar && t.last.includes("||") ? 1 : 0]}</Text>
                    <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      <AppStatusPill status={t.status} />
                      {t.at ? <Pill label={fmtTime(t.at)} /> : null}
                    </View>
                  </ItemCard>
                ))}
              </>
            )
          }
        </Load>
      )}
    </DeptPage>
  );
}

/** One thread with an applicant, from the department side. */
export function DeptThread({ kind, id }: { kind: Kind; id: string }) {
  const d = useDT();
  const app = useLoad(() => review.get(kind, id), [kind, id]);
  return (
    <DeptPage back tabs={false}>
      <Section title={app.data?.info.name ?? d.t("Messages", "الرسائل")} caption={d.t("Conversation with the owner. Status changes appear here too.", "محادثة مع المالك. تظهر تغييرات الحالة هنا أيضًا.")} />
      <ThreadView mine="ADMIN" load={() => review.messages(kind, id).then((r) => r.messages)} markRead={() => review.markRead(kind, id)} send={(b, a) => review.send(kind, id, b, a)} />
    </DeptPage>
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
