// Tow admin: one truck = Detail (docs/guide/10-ui-system.md): photo, facts, private documents, checklist, history. ONE primary in the
// footer: Approve truck (enabled when the checklist passes; the server enforces the same). ⋮ = reject (reason required), edit truck,
// archive (reason required) / restore. Every decision is audited.
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GButton, GIcon, Note, StatusChip } from "../../components/garage";
import type { ItemAction } from "../../components/ItemActionsMenu";
import { appStatus } from "../../components/manage/ManagePage";
import { Block, CheckRow, DocRows, Facts, History, Loaded, Page } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { hapticError, hapticSuccess } from "../../motion";
import { gShape, useGarageTheme } from "../../theme/garage";
import { privateImageSource } from "../shared/api";
import { towAdminService } from "../tow/towService";
import { docLabel } from "../tow/truckBits";
import { checklists, hasBlocking, truckTypeLabel } from "./departments";

const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const ltr = (v: string) => "⁦" + v + "⁩";
const HISTORY: Record<string, [string, string]> = { SUBMITTED: ["Submitted", "تم التقديم"], APPROVED: ["Approved", "تمت الموافقة"], REJECTED: ["Rejected", "تم الرفض"] };

function TruckPhoto({ uri }: { uri?: string | null }) {
  const { g } = useGarageTheme();
  const [src, setSrc] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  useEffect(() => {
    let alive = true;
    // the truck photo is served from a public file URL (already absolute); private documents need the bearer token
    if (uri && /^https?:/.test(uri)) setSrc({ uri, headers: {} });
    else if (uri) privateImageSource(uri).then((s) => alive && setSrc(s), () => {});
    return () => { alive = false; };
  }, [uri]);
  return (
    <View style={{ width: "100%", height: 180, borderRadius: gShape.small, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
      {src ? <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <GIcon name="car-sport-outline" size={42} color={g.accentText} />}
    </View>
  );
}

export function TruckReview({ id }: { id: string }) {
  const { t } = useL();
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const state = useLoad(async () => {
    const truck = (await towAdminService.listTrucks(NOACTOR)).find((x) => x.id === id);
    if (!truck) throw new Error(t("Truck not found.", "الشاحنة غير موجودة."));
    const company = await towAdminService.getCompany(NOACTOR, truck.companyId);
    return { truck: company.trucks.find((x) => x.id === id) ?? truck, company: company.company };
  }, [id]);
  const truck = state.data?.truck;
  const items = truck ? checklists.truck(t, truck) : [];
  const blocked = hasBlocking(items);
  const decide = async (x: { approve: true } | { approve: false; reason: string }) => {
    setBusy(true); setErr(null);
    try { await towAdminService.decideTruck(NOACTOR, id, x); hapticSuccess(); await state.reload(); } catch (e) { hapticError(); setErr((e as Error).message); throw e; } finally { setBusy(false); }
  };
  const actions: ItemAction[] = !truck ? [] : [
    ...(truck.verification !== "REJECTED" ? [{ key: "reject", label: t("Reject truck", "رفض الشاحنة"), icon: "close-circle-outline" as const, destructive: true,
      confirm: { title: t("Reject this truck?", "رفض هذه الشاحنة؟"), confirmLabel: t("Confirm rejection", "تأكيد الرفض"), reason: { label: t("Rejection reason (required)", "سبب الرفض (مطلوب)"), required: true } },
      run: (reason?: string) => decide({ approve: false, reason: reason ?? "" }) }] : []),
    { key: "edit", label: t("Edit truck", "تعديل الشاحنة"), icon: "create-outline", run: () => router.push(`/dept/edit/truck/${truck.id}` as never) },
    truck.archivedAt
      ? { key: "restore", label: t("Restore truck", "استعادة الشاحنة"), icon: "arrow-undo-outline", run: () => towAdminService.archiveTruck(NOACTOR, truck.id, { archived: false }).then(() => state.reload()) }
      : { key: "archive", label: t("Archive truck (out of service)", "أرشفة الشاحنة (خارج الخدمة)"), icon: "archive-outline", destructive: true, disabled: truck.hasActiveJob,
        confirm: { title: t("Take this truck out of service?", "إخراج هذه الشاحنة من الخدمة؟"), confirmLabel: t("Confirm archive", "تأكيد الأرشفة"), reason: { label: t("Reason for taking it out of service (required)", "سبب إخراجها من الخدمة (مطلوب)"), required: true } },
        run: (reason?: string) => towAdminService.archiveTruck(NOACTOR, truck.id, { archived: true, reason: reason ?? "" }).then(() => state.reload()) },
  ];
  return (
    <Page title={truck ? ltr(truck.plate) : t("Truck", "الشاحنة")} line={state.data?.company.name} actions={actions.length ? actions : undefined} onRefresh={() => void state.reload()} refreshing={false}
      footer={truck && truck.verification !== "APPROVED" ? <GButton icon="checkmark-circle-outline" label={t("Approve truck", "اعتماد الشاحنة")} busy={busy} disabled={busy || blocked} onPress={() => void decide({ approve: true }).catch(() => undefined)} /> : undefined}>
      <Loaded state={state}>{({ truck, company }) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip {...appStatus(truck.verification, t)} /></View>
          {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
          {blocked && truck.verification !== "APPROVED" ? <Note tone="warning" icon="alert-circle-outline">{t("A photo and both documents are required before approving.", "الصورة والمستندان مطلوبة قبل الاعتماد.")}</Note> : null}
          {truck.rejectionReason ? <Note tone="danger" icon="close-circle-outline">{truck.rejectionReason}</Note> : null}
          {truck.expiredDocuments?.length ? <Note tone="danger" icon="alert-circle-outline">{`${t("Documents expired: no new work", "مستندات منتهية: لا أعمال جديدة")} (${truck.expiredDocuments.map((x) => `${docLabel(t, x.kind)} ${x.expiresAt.slice(0, 10)}`).join(", ")}). ${t("Only this truck is affected: the company and its other trucks keep working.", "هذه الشاحنة فقط متأثرة: الشركة وباقي شاحناتها تعمل.")}`}</Note> : null}
          {truck.archivedAt ? <Note tone="danger" icon="archive-outline">{`${t("Archived by MOTEXA", "مؤرشفة من موتكسا")}${truck.archiveReason ? `: ${truck.archiveReason}` : ""}. ${t("Out of service until restored. Its documents and history are kept.", "خارج الخدمة حتى تتم استعادتها. تُحفظ مستنداتها وسجلها.")}`}</Note> : null}
          <TruckPhoto uri={truck.photoUri} />
          <Block title={t("Truck", "الشاحنة")}>
            <Facts rows={[[t("Type", "النوع"), truckTypeLabel(t, truck.type)], [t("Vehicle", "المركبة"), [truck.make, truck.model, truck.year].filter(Boolean).join(" ")],
              [t("Max load", "الحمل الأقصى"), truck.maxWeightKg ? `${truck.maxWeightKg} ${t("kg", "كغ")}` : null], [t("Company", "الشركة"), company.name],
              [t("Operates from", "تعمل من"), truck.baseLat != null && truck.baseLng != null ? [truck.locationAddress, `${truck.baseLat.toFixed(4)}, ${truck.baseLng.toFixed(4)}`].filter(Boolean).join(" · ") : null]]} />
          </Block>
          <Block title={t("Documents", "المستندات")}>
            <DocRows docs={truck.documents.map((x) => ({ label: docLabel(t, x.kind), fileName: x.fileName, expiresAt: x.expiresAt, uri: x.uri }))} />
          </Block>
          <Block title={t("Checklist", "قائمة التحقق")}>{items.map((i) => <CheckRow key={i.label} ok={i.ok} label={i.label} hint={i.hint} />)}</Block>
          {truck.history.length ? <Block title={t("History", "السجل")}>
            <History items={[...truck.history].reverse().map((h) => ({ title: HISTORY[h.action] ? t(...HISTORY[h.action]!) : h.action, at: h.at.slice(0, 10), who: h.actor, note: h.reason }))} />
          </Block> : null}
        </>
      )}</Loaded>
    </Page>
  );
}
