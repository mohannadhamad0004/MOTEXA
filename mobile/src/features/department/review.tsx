// ONE review screen for every department kind: info, documents, approval checklist, decision (approve / reject with a reason), history.
// The bodies of the former admin/tow/* and admin/shops/* screens live here, restyled in the super admin look.
// Data and decisions still go through towAdminService / partsAdminService (unchanged).
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/MotexaVisual";
import InteractiveButton from "../../components/InteractiveButton";
import { CATALOG_GROUPS } from "../../core/constants/categories";
import { cityLabel } from "../../core/constants/cities";
import { formatPrice } from "../../core/constants/money";
import { useLoad } from "../../core/hooks/useLoad";
import { hapticError, hapticSuccess } from "../../motion";
import { Product, partsAdminService } from "../parts/partsService";
import { privateImageSource } from "../shared/api";
import { DocViewer, fmtDate, isExpired } from "../shared/blocks";
import { TowCompany, Truck, towAdminService } from "../tow/towService";
import { Check, DButton, Empty, KV, Load, Panel, Pill, ReasonBox, Section, StatusPill, DeptPage, useDT } from "./ui";
import { CheckItem, ReviewKind, Status, checklists, hasBlocking, truckTypeLabel } from "./departments";

const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
type Decision = { approve: true } | { approve: false; reason: string };

const CATEGORY_BY_KEY = new Map(CATALOG_GROUPS.flatMap((g) => g.categories).map((c) => [c.key, c]));
const ltr = (v: string) => "⁦" + v + "⁩";

function Docs({ title, docs }: { title: string; docs: { label: string; fileName: string; expiresAt?: string | null; uri?: string | null }[] }) {
  const d = useDT();
  const [open, setOpen] = useState<{ label: string; uri: string } | null>(null);
  return (
    <>
      <DocViewer doc={open} onClose={() => setOpen(null)} />
      <Section title={title} />
      <Panel>
        {docs.length === 0 ? <Text style={{ color: d.muted, fontSize: 13, textAlign: d.align }}>{d.t("No documents uploaded.", "لم يتم رفع مستندات.")}</Text> : null}
        {docs.map((doc, i) => (
          <InteractiveButton
            key={i}
            disabled={!doc.uri}
            accessibilityRole="button"
            accessibilityLabel={doc.label}
            onPress={() => doc.uri && setOpen({ label: doc.label, uri: doc.uri })}
            style={{ flexDirection: d.row, alignItems: "center", gap: 12, paddingVertical: 8 }}
          >
            <Ionicons name="document-lock-outline" size={22} color={d.accent} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: d.ink, fontSize: 13, lineHeight: 20, fontWeight: "600", textAlign: d.align }}>{doc.label}</Text>
              <Text numberOfLines={1} style={{ color: d.muted, fontSize: 11, lineHeight: 17, textAlign: d.align }}>
                {doc.fileName}
                {doc.expiresAt ? ` · ${d.t("expires", "ينتهي")} ${fmtDate(doc.expiresAt)}` : ""}
              </Text>
            </View>
            {isExpired(doc.expiresAt) ? <Pill tone="bad" icon="alert-circle-outline" label={d.t("Expired", "منتهية")} /> : null}
            {doc.uri ? <Ionicons name="eye-outline" size={18} color={d.muted} /> : null}
          </InteractiveButton>
        ))}
        <Text style={{ color: d.muted, fontSize: 11, lineHeight: 17, marginTop: 6, textAlign: d.align }}>
          {d.t("Private: visible only to MOTEXA admins and the owner.", "خاصة: تظهر فقط لمسؤولي MOTEXA والمالك.")}
        </Text>
      </Panel>
    </>
  );
}

function Checklist({ items }: { items: CheckItem[] }) {
  const d = useDT();
  return (
    <>
      <Section title={d.t("Approval checklist", "قائمة التحقق")} />
      <Panel>
        {items.map((c, i) => (
          <Check key={i} ok={c.ok} label={c.label} hint={c.hint ?? (!c.ok && c.blocking ? d.t("Required to approve", "مطلوب للاعتماد") : undefined)} />
        ))}
      </Panel>
    </>
  );
}

function History({ items }: { items: { at: string; actor: string; action: string; reason?: string }[] }) {
  const d = useDT();
  if (!items.length) return null;
  const label: Record<string, string> = { SUBMITTED: d.t("Submitted", "تم التقديم"), APPROVED: d.t("Approved", "تمت الموافقة"), REJECTED: d.t("Rejected", "تم الرفض") };
  return (
    <>
      <Section title={d.t("Verification history", "سجل الاعتماد")} />
      <Panel>
        {[...items].reverse().map((h, i) => (
          <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: d.border }}>
            <View style={{ flexDirection: d.row, justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: d.ink, fontSize: 13, fontWeight: "600" }}>{label[h.action] ?? h.action}</Text>
              <Text style={{ color: d.muted, fontSize: 11 }}>{fmtDate(h.at)}</Text>
            </View>
            <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{h.actor}</Text>
            {h.reason ? <Text style={{ color: h.action === "REJECTED" ? d.bad : d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{h.reason}</Text> : null}
          </View>
        ))}
      </Panel>
    </>
  );
}

/** Approve / reject with the required reason. `blocked` disables Approve (a checklist item the server would refuse). */
function DecisionPanel({
  title,
  note,
  status,
  rejectionReason,
  approveLabel,
  rejectLabel,
  blocked,
  onDecide,
}: {
  title: string;
  note?: string;
  status: Status;
  rejectionReason?: string | null;
  approveLabel: string;
  rejectLabel: string;
  blocked?: string;
  onDecide: (d: Decision) => Promise<void>;
}) {
  const d = useDT();
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (x: Decision) => {
    setBusy(true);
    setErr(null);
    try {
      await onDecide(x);
      hapticSuccess();
      setRejecting(false);
    } catch (e: any) {
      hapticError();
      setErr(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Section title={title} />
      <Panel>
        {note ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{note}</Text> : null}
        {rejectionReason ? <Text style={{ color: d.bad, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{rejectionReason}</Text> : null}
        {blocked && status !== "APPROVED" ? <Text style={{ color: d.warn, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{blocked}</Text> : null}
        {err ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{err}</Text> : null}
        {!rejecting ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            {status !== "APPROVED" ? <DButton label={approveLabel} icon="checkmark-circle-outline" disabled={busy || !!blocked} onPress={() => run({ approve: true })} /> : null}
            {status !== "REJECTED" ? <DButton label={rejectLabel} variant="danger" disabled={busy} onPress={() => setRejecting(true)} /> : null}
          </View>
        ) : (
          <ReasonBox
            title={d.t("Rejection reason (required)", "سبب الرفض (مطلوب)")}
            confirmLabel={d.t("Confirm rejection", "تأكيد الرفض")}
            busy={busy}
            onCancel={() => setRejecting(false)}
            onConfirm={(reason) => run({ approve: false, reason })}
          />
        )}
      </Panel>
    </>
  );
}

function PrivatePhoto({ uri }: { uri?: string | null }) {
  const d = useDT();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  useEffect(() => {
    let alive = true;
    // the truck photo is served from a public file URL (already absolute); private documents need the bearer token
    if (uri && /^https?:/.test(uri)) setSrc({ uri, headers: {} });
    else if (uri) privateImageSource(uri).then((s) => alive && setSrc(s), () => {});
    return () => {
      alive = false;
    };
  }, [uri]);
  return (
    <View style={{ width: "100%", height: 180, borderRadius: 18, overflow: "hidden", backgroundColor: d.soft, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
      {src ? <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="car-sport-outline" size={42} color={d.accent} />}
    </View>
  );
}

// ---------------------------------------------------------------- towing: truck
export function TruckReview({ id }: { id: string }) {
  const d = useDT();
  const state = useLoad(async () => {
    const truck = (await towAdminService.listTrucks(NOACTOR)).find((x) => x.id === id);
    if (!truck) throw new Error(d.t("Truck not found.", "الشاحنة غير موجودة."));
    const company = await towAdminService.getCompany(NOACTOR, truck.companyId);
    return { truck: company.trucks.find((x) => x.id === id) ?? truck, company: company.company };
  }, [id]);
  return (
    <DeptPage back tabs={false} onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
      <Load state={state}>
        {({ truck, company }: { truck: Truck; company: TowCompany }) => {
          const items = checklists.truck(d.t, truck);
          const missing = hasBlocking(items);
          return (
            <>
              <Header title={ltr(truck.plate)} status={truck.verification} sub={company.name} />
              {truck.expiredDocuments?.length ? (
                <Panel tone="bad" title={d.t("Documents expired: no new work", "مستندات منتهية: لا أعمال جديدة")} icon="alert-circle-outline">
                  {truck.expiredDocuments.map((x) => (
                    <Text key={x.kind} style={{ color: d.ink, fontSize: 13, lineHeight: 21, textAlign: d.align }}>
                      {(x.kind === "REGISTRATION" ? d.t("Vehicle registration", "ترخيص المركبة") : x.kind === "OPERATING_LICENSE" ? d.t("Operating licence", "رخصة التشغيل") : d.t("Insurance", "التأمين"))} · {d.t("expired", "منتهي")} {fmtDate(x.expiresAt)}
                    </Text>
                  ))}
                  <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{d.t("Only this truck is affected: the company and its other trucks keep working. Renew the document with Edit truck; the truck is eligible again at once.", "هذه الشاحنة فقط متأثرة: الشركة وباقي شاحناتها تعمل. جدّد المستند من تعديل الشاحنة؛ تصبح الشاحنة مؤهلة فورًا.")}</Text>
                </Panel>
              ) : null}
              {truck.archivedAt ? (
                <Panel tone="bad" title={d.t("Archived by MOTEXA", "مؤرشفة من موتكسا")} icon="archive-outline">
                  <Text style={{ color: d.ink, fontSize: 13, lineHeight: 21, textAlign: d.align }}>{truck.archiveReason ?? ""}</Text>
                  <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>{d.t("Out of service until restored. Its documents and history are kept.", "خارج الخدمة حتى تتم استعادتها. تُحفظ مستنداتها وسجلها.")}</Text>
                </Panel>
              ) : null}
              <PrivatePhoto uri={truck.photoUri} />
              <View style={{ gap: 8, marginBottom: 12 }}>
                <DButton variant="ghost" icon="create-outline" label={d.t("Edit truck", "تعديل الشاحنة")} onPress={() => router.push(`/dept/edit/truck/${truck.id}` as never)} />
                <ArchiveControl truck={truck} onDone={() => state.reload()} />
              </View>
              <Panel>
                <KV k={d.t("Type", "النوع")} v={truckTypeLabel(d.t, truck.type)} />
                <KV k={d.t("Vehicle", "المركبة")} v={[truck.make, truck.model, truck.year].filter(Boolean).join(" ")} />
                {truck.maxWeightKg ? <KV k={d.t("Max load", "الحمل الأقصى")} v={`${truck.maxWeightKg} ${d.t("kg", "كغ")}`} /> : null}
                <KV k={d.t("Company", "الشركة")} v={company.name} />
                {truck.baseLat != null && truck.baseLng != null ? <KV k={d.t("Operates from", "تعمل من")} v={[truck.locationAddress, `${truck.baseLat.toFixed(4)}, ${truck.baseLng.toFixed(4)}`].filter(Boolean).join(" · ")} /> : null}
              </Panel>
              <Docs
                title={d.t("Documents", "المستندات")}
                docs={truck.documents.map((x) => ({ label: x.kind === "REGISTRATION" ? d.t("Vehicle registration", "ترخيص المركبة") : x.kind === "OPERATING_LICENSE" ? d.t("Operating licence", "رخصة التشغيل") : d.t("Insurance", "التأمين"), fileName: x.fileName, expiresAt: x.expiresAt, uri: x.uri }))}
              />
              <Checklist items={items} />
              <DecisionPanel
                title={d.t("Truck decision", "قرار الشاحنة")}
                status={truck.verification}
                rejectionReason={truck.rejectionReason}
                blocked={missing ? d.t("A photo and both documents are required before approving.", "الصورة والمستندان مطلوبة قبل الاعتماد.") : undefined}
                approveLabel={d.t("Approve truck", "اعتماد الشاحنة")}
                rejectLabel={d.t("Reject truck", "رفض الشاحنة")}
                onDecide={async (x) => {
                  await towAdminService.decideTruck(NOACTOR, truck.id, x);
                  await state.reload();
                }}
              />
              <History items={truck.history} />
            </>
          );
        }}
      </Load>
    </DeptPage>
  );
}

/** Archive (reason required) or restore a truck: out of service without deleting it or its documents. */
function ArchiveControl({ truck, onDone }: { truck: Truck; onDone: () => void }) {
  const d = useDT();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (change: { archived: true; reason: string } | { archived: false }) => {
    setBusy(true);
    setErr(null);
    try {
      await towAdminService.archiveTruck(NOACTOR, truck.id, change);
      hapticSuccess();
      setAsking(false);
      onDone();
    } catch (e: any) {
      hapticError();
      setErr(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {err ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, textAlign: d.align }}>{err}</Text> : null}
      {truck.archivedAt ? (
        <DButton variant="ghost" icon="arrow-undo-outline" label={d.t("Restore truck", "استعادة الشاحنة")} disabled={busy} onPress={() => run({ archived: false })} />
      ) : asking ? (
        <ReasonBox title={d.t("Reason for taking it out of service (required)", "سبب إخراجها من الخدمة (مطلوب)")} confirmLabel={d.t("Confirm archive", "تأكيد الأرشفة")} busy={busy} onCancel={() => setAsking(false)} onConfirm={(reason) => run({ archived: true, reason })} />
      ) : (
        <DButton variant="ghost" icon="archive-outline" label={d.t("Archive truck (out of service)", "أرشفة الشاحنة (خارج الخدمة)")} disabled={busy || truck.hasActiveJob} onPress={() => setAsking(true)} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------- parts: product moderation (hide / show)
export function ProductLine({ product: p, onDone }: { product: Product; onDone: () => void }) {
  const d = useDT();
  const [hiding, setHiding] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cat = p.category ? CATEGORY_BY_KEY.get(p.category) : null;
  const condition = { NEW: d.t("New", "جديد"), USED: d.t("Used", "مستعمل"), REFURBISHED: d.t("Refurbished", "مجدّد") }[p.condition];
  const change = async (c: { hidden: true; reason: string } | { hidden: false }) => {
    setBusy(true);
    setErr(null);
    try {
      await partsAdminService.setProductVisibility(NOACTOR, p.id, c);
      hapticSuccess();
      setHiding(false);
      onDone();
    } catch (e: any) {
      hapticError();
      setErr(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };
  // what a customer gets: only an approved shop's un-hidden product with a real photo. Every blocking reason is shown,
  // and "Customer visible" only when the server says so (a photo alone does not publish a product).
  const state = p.customerVisible ? (
    <Pill tone="ok" icon="eye-outline" label={d.t("Customer visible", "ظاهر للعملاء")} />
  ) : (
    <>
      {p.hidden ? <Pill tone="bad" icon="eye-off-outline" label={d.t("Hidden by MOTEXA", "مخفي من موتكسا")} /> : null}
      {p.hasPhoto === false ? <Pill tone="warn" icon="image-outline" label={d.t("Product photo required — hidden from customers", "صورة المنتج مطلوبة — مخفي عن العملاء")} /> : null}
      {!p.hidden && p.hasPhoto !== false ? <Pill icon="time-outline" label={d.t("Not visible: shop not approved", "غير ظاهر: المتجر غير معتمد")} /> : null}
    </>
  );
  return (
    <Panel tone={p.hidden ? "bad" : undefined}>
      <InteractiveButton accessibilityRole="button" accessibilityLabel={p.name} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: d.row, gap: 12, alignItems: "flex-start" }}>
        <View style={{ width: 76, height: 76, borderRadius: 12, overflow: "hidden", backgroundColor: "#F4EFE8", alignItems: "center", justifyContent: "center" }}>
          {p.imageUri ? <Image source={{ uri: p.imageUri }} style={{ width: "100%", height: "100%" }} contentFit="scale-down" /> : <Ionicons name="image-outline" size={24} color="#B9AFA3" />}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={2} style={{ color: d.ink, fontSize: 14, lineHeight: 21, fontWeight: "700", textAlign: d.align }}>{p.name}</Text>
          <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, textAlign: d.align, writingDirection: "ltr" }}>{p.partNumber}</Text>
          <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>{[p.brand, condition, cat ? (d.ar ? cat.ar : cat.en) : null].filter(Boolean).join(" · ")}</Text>
          <View style={{ flexDirection: d.row, alignItems: "center", gap: 8 }}>
            <Text style={{ color: d.accent, fontSize: 14, fontWeight: "700" }}>{formatPrice(p.price)}</Text>
            <Pill label={`${d.t("Qty", "الكمية")} ${p.stock}`} />
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={d.muted} />
      </InteractiveButton>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 8 }}>{state}</View>
      {open ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          {p.description ? <Text style={{ color: d.ink, fontSize: 13, lineHeight: 20, textAlign: d.align }}>{p.description}</Text> : null}
          <KV k={d.t("Part / OEM number", "رقم القطعة / OEM")} v={ltr(p.partNumber)} />
          <KV k={d.t("Type", "النوع")} v={p.partType ? (p.partType === "OEM" ? "OEM" : d.t("Aftermarket", "بديل")) : d.t("Not specified", "غير محدد")} />
          {p.createdAt ? <KV k={d.t("Created", "أُنشئ")} v={fmtDate(p.createdAt)} /> : null}
          {p.updatedAt ? <KV k={d.t("Updated", "حُدّث")} v={fmtDate(p.updatedAt)} /> : null}
          <Text style={{ color: d.ink, fontSize: 12, fontWeight: "700", textAlign: d.align, marginTop: 4 }}>{d.t("Vehicle fitment", "توافق المركبات")}</Text>
          {p.fitments.length ? (
            p.fitments.map((f, i) => (
              <Text key={i} style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{ltr(`${f.make} ${f.model} · ${f.yearFrom}–${f.yearTo}${f.trim ? " · " + f.trim : ""}`)}</Text>
            ))
          ) : (
            <Text style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>{d.t("No fitment listed.", "لا يوجد توافق محدد.")}</Text>
          )}
        </View>
      ) : null}
      {p.hidden && p.hiddenReason ? <Text style={{ color: d.bad, fontSize: 12, lineHeight: 19, textAlign: d.align, marginTop: 6 }}>{p.hiddenReason}</Text> : null}
      {err ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, textAlign: d.align }}>{err}</Text> : null}
      <View style={{ marginTop: 8, gap: 8 }}>
        {p.hasPhoto === false ? <DButton icon="camera-outline" label={d.t("Add product photo", "إضافة صورة المنتج")} onPress={() => router.push(`/dept/edit/product/${p.id}` as never)} /> : null}
        <DButton variant="ghost" icon="create-outline" label={d.t("Edit product", "تعديل المنتج")} onPress={() => router.push(`/dept/edit/product/${p.id}` as never)} />
        {!hiding && !p.hidden ? <DButton variant="ghost" icon="eye-off-outline" label={d.t("Hide", "إخفاء")} disabled={busy} onPress={() => setHiding(true)} /> : null}
        {!hiding && p.hidden ? <DButton variant="ghost" icon="eye-outline" label={d.t("Show again", "إظهار مرة أخرى")} disabled={busy} onPress={() => change({ hidden: false })} /> : null}
        {hiding ? (
          <ReasonBox
            title={d.t("Reason for hiding (required)", "سبب الإخفاء (مطلوب)")}
            confirmLabel={d.t("Confirm hide", "تأكيد الإخفاء")}
            busy={busy}
            onCancel={() => setHiding(false)}
            onConfirm={(reason) => change({ hidden: true, reason })}
          />
        ) : null}
      </View>
    </Panel>
  );
}

function Header({ title, status, sub }: { title: string; status: Status; sub?: string }) {
  const d = useDT();
  return (
    <View style={{ marginBottom: 14, gap: 8 }}>
      <Text style={{ color: d.ink, fontSize: 22, lineHeight: 31, fontWeight: "600", textAlign: d.align }}>{title}</Text>
      {sub ? <Text style={{ color: d.muted, fontSize: 13, textAlign: d.align }}>{sub}</Text> : null}
      <StatusPill value={status} />
    </View>
  );
}

