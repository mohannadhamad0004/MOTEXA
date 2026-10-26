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

// ---------------------------------------------------------------- towing: company
function CompanyReview({ id }: { id: string }) {
  const d = useDT();
  const state = useLoad(() => towAdminService.getCompany(NOACTOR, id), [id]);
  return (
    <DeptPage back tabs={false} onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
      <Load state={state}>
        {({ company, trucks, companyHistory }: { company: TowCompany; trucks: Truck[]; companyHistory: any[] }) => {
          const history = [
            ...companyHistory.map((h) => ({ ...h, actor: `${h.actor} · ${d.t("company", "الشركة")}` })),
            ...trucks.flatMap((tr) => tr.history.map((h) => ({ ...h, actor: `${h.actor} · ${tr.plate}` }))),
          ].sort((a, b) => a.at.localeCompare(b.at));
          return (
            <>
              <Header title={company.name} status={company.verification} />
              <Panel>
                <KV k={d.t("Contact", "المسؤول")} v={company.contactName} />
                <KV k={d.t("Phone", "الهاتف")} v={company.phone ? ltr(company.phone) : ""} />
                <KV k={d.t("Email", "البريد")} v={company.ownerEmail} />
                <KV k={d.t("City", "المدينة")} v={cityLabel(company.city, d.ar)} />
                <KV k={d.t("Address", "العنوان")} v={company.address} />
                <KV k={d.t("Working hours", "ساعات العمل")} v={company.workingHours} />
                <KV k={d.t("Service area", "منطقة الخدمة")} v={company.serviceCities.map((c) => cityLabel(c, d.ar)).join(d.ar ? "، " : ", ")} />
                <KV k={d.t("Description", "الوصف")} v={company.description} />
              </Panel>
              <Docs title={d.t("Company documents", "مستندات الشركة")} docs={company.documents.map((x) => ({ label: x.kind, fileName: x.fileName, uri: x.uri }))} />
              <Checklist items={checklists.company(d.t, company)} />
              <DecisionPanel
                title={d.t("Company decision", "قرار الشركة")}
                note={d.t("This approves the company account only. Each truck is approved separately below.", "هذا اعتماد لحساب الشركة فقط. تُعتمد كل شاحنة على حدة أدناه.")}
                status={company.verification}
                rejectionReason={company.rejectionReason}
                approveLabel={d.t("Approve company", "اعتماد الشركة")}
                rejectLabel={d.t("Reject company", "رفض الشركة")}
                onDecide={async (x) => {
                  await towAdminService.decideCompany(NOACTOR, company.id, x);
                  await state.reload();
                }}
              />
              <Section title={`${d.t("Trucks", "الشاحنات")} (${trucks.length})`} />
              {trucks.length === 0 ? <Empty icon="car-outline" text={d.t("This company has no trucks yet.", "لا توجد شاحنات لهذه الشركة بعد.")} /> : null}
              {trucks.map((tr) => (
                <TruckLine key={tr.id} truck={tr} />
              ))}
              <History items={history} />
            </>
          );
        }}
      </Load>
    </DeptPage>
  );
}

function TruckLine({ truck }: { truck: Truck }) {
  const d = useDT();
  return (
    <InteractiveButton
      accessibilityRole="button"
      accessibilityLabel={truck.plate}
      onPress={() => router.push(`/dept/review/truck/${truck.id}` as never)}
      style={{ borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 10, backgroundColor: d.surface, borderColor: d.border, flexDirection: d.row, alignItems: "center", gap: 10 }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text numberOfLines={1} style={{ color: d.ink, fontSize: 14, fontWeight: "600", textAlign: d.align }}>{ltr(truck.plate)} · {[truck.make, truck.model, truck.year].filter(Boolean).join(" ")}</Text>
        <StatusPill value={truck.verification} />
      </View>
      <Ionicons name={d.ar ? "chevron-back" : "chevron-forward"} size={19} color={d.accent} />
    </InteractiveButton>
  );
}

// ---------------------------------------------------------------- towing: truck
function TruckReview({ id }: { id: string }) {
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
              <PrivatePhoto uri={truck.photoUri} />
              <Panel>
                <KV k={d.t("Type", "النوع")} v={truckTypeLabel(d.t, truck.type)} />
                <KV k={d.t("Vehicle", "المركبة")} v={[truck.make, truck.model, truck.year].filter(Boolean).join(" ")} />
                {truck.maxWeightKg ? <KV k={d.t("Max load", "الحمل الأقصى")} v={`${truck.maxWeightKg} ${d.t("kg", "كغ")}`} /> : null}
                <KV k={d.t("Company", "الشركة")} v={company.name} />
              </Panel>
              <Docs
                title={d.t("Documents", "المستندات")}
                docs={truck.documents.map((x) => ({ label: x.kind === "REGISTRATION" ? d.t("Vehicle registration", "ترخيص المركبة") : d.t("Insurance", "التأمين"), fileName: x.fileName, expiresAt: x.expiresAt, uri: x.uri }))}
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

// ---------------------------------------------------------------- parts: shop
function ProductLine({ product: p, onDone }: { product: Product; onDone: () => void }) {
  const d = useDT();
  const [hiding, setHiding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
  return (
    <Panel tone={p.hidden ? "bad" : undefined}>
      <Text numberOfLines={2} style={{ color: d.ink, fontSize: 14, lineHeight: 21, fontWeight: "600", textAlign: d.align }}>{p.name}</Text>
      <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, textAlign: d.align }}>{p.brand} · {p.partNumber}</Text>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 }}>
        <Text style={{ color: d.accent, fontSize: 14, fontWeight: "700" }}>{formatPrice(p.price)}</Text>
        <Pill label={`${d.t("Qty", "الكمية")} ${p.stock}`} />
        {p.hidden ? <Pill tone="bad" icon="eye-off-outline" label={d.t("Hidden", "مخفية")} /> : null}
      </View>
      {p.hidden && p.hiddenReason ? <Text style={{ color: d.bad, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{p.hiddenReason}</Text> : null}
      {err ? <Text accessibilityRole="alert" style={{ color: d.bad, fontSize: 12, textAlign: d.align }}>{err}</Text> : null}
      <View style={{ marginTop: 8 }}>
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

function ShopReview({ id }: { id: string }) {
  const d = useDT();
  const state = useLoad(() => partsAdminService.getShop(NOACTOR, id), [id]);
  return (
    <DeptPage back tabs={false} onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
      <Load state={state}>
        {(s) => (
          <>
            <Header title={s.name} status={s.verification} />
            <Panel>
              <KV k={d.t("Owner", "المالك")} v={s.ownerName} />
              <KV k={d.t("Phone", "الهاتف")} v={s.phone ? ltr(s.phone) : ""} />
              <KV k={d.t("Email", "البريد")} v={s.ownerEmail} />
              <KV k={d.t("City", "المدينة")} v={cityLabel(s.city, d.ar)} />
              <KV k={d.t("Address", "العنوان")} v={s.address} />
            </Panel>
            <Docs title={d.t("Verification documents", "مستندات التحقق")} docs={s.documents.map((x) => ({ label: x.kind, fileName: x.fileName, uri: x.uri }))} />
            <Checklist items={checklists.shop(d.t, s)} />
            <DecisionPanel
              title={d.t("Shop decision", "قرار المتجر")}
              note={d.t("This approves the shop account only. Product listings belong to the shop; you can only hide or show them.", "هذا اعتماد لحساب المتجر فقط. المنتجات يملكها المتجر ويمكنك إخفاؤها أو إظهارها فقط.")}
              status={s.verification}
              rejectionReason={s.rejectionReason}
              approveLabel={d.t("Approve shop", "اعتماد المتجر")}
              rejectLabel={d.t("Reject shop", "رفض المتجر")}
              onDecide={async (x) => {
                await partsAdminService.decideShop(NOACTOR, s.id, x);
                await state.reload();
              }}
            />
            <Section title={`${d.t("Products", "المنتجات")} (${s.products.length})`} />
            {s.products.length === 0 ? <Empty icon="cube-outline" text={d.t("This shop has no products yet.", "لا توجد منتجات لهذا المتجر بعد.")} /> : null}
            {s.products.map((p) => (
              <ProductLine key={p.id} product={p} onDone={() => void state.reload()} />
            ))}
            <History items={s.history} />
          </>
        )}
      </Load>
    </DeptPage>
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

/** The one review screen. `mechanic` has no screen of ours: Diala's review screen (Requests tab) handles it. */
export function ReviewScreen({ kind, id }: { kind: ReviewKind; id: string }) {
  useEffect(() => {
    if (kind === "mechanic") router.replace("/dept/requests" as never);
  }, [kind]);
  if (kind === "company") return <CompanyReview id={id} />;
  if (kind === "truck") return <TruckReview id={id} />;
  if (kind === "shop") return <ShopReview id={id} />;
  return null;
}
