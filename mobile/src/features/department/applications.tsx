// Provider applications in /dept (tow companies, parts shops and garages): the Messages tab (Inbox), one thread with an applicant, and the one
// review route (company / shop = application review, truck = the truck review).
import { Href, router } from "expo-router";
import { useCallback, useState } from "react";
import { StatusChip as GStatusChip } from "../../components/garage";
import { FilterChips, ManagePage, appStatus } from "../../components/manage/ManagePage";
import { ThreadPage, ThreadRow } from "../../components/manage/Thread";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { Attachment, Kind, review } from "../provider/api";
import { ApplicationReview as NewApplicationReview } from "./applicationReview";
import { useDepartment } from "./DepartmentContext";
import { ReviewKind } from "./departments";
import { MechanicApplicationReview } from "./mechanicsAdmin";
import { TruckReview } from "./review";

const go = (path: string) => router.push(path as Href);
const kindLabel = (t: (en: string, ar: string) => string, k: Kind) => (k === "TOW" ? t("Tow company", "شركة سحب") : k === "GARAGE" ? t("Garage", "كراج") : t("Parts shop", "متجر قطع غيار"));

// ---------------------------------------------------------------- messages
/** The Messages tab: one row per application that has a thread. */
export function DeptMessages() {
  const { active } = useDepartment();
  const { t, isArabic } = useL();
  const kind = active.provider;
  const state = useLoad(async () => (kind ? review.threads(kind) : []), [kind], 15000);
  const [q, setQ] = useState(""), [show, setShow] = useState<"ALL" | "UNREAD">("ALL");
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const all = (state.data ?? []).filter(x => words.every(w => x.name.toLowerCase().includes(w)));
  const rows = all.filter(x => show === "ALL" || x.unread > 0).sort((x, y) => Number(y.unread > 0) - Number(x.unread > 0) || String(y.at ?? "").localeCompare(String(x.at ?? "")));
  const unread = (state.data ?? []).filter(x => x.unread > 0).length;
  return (
    <ManagePage title={t("Messages", "الرسائل")} line={kind ? t(`${unread} unread conversations`, `${unread} محادثات غير مقروءة`) : t(active.en, active.ar)} back={false} tabBar
      search={kind ? { value: q, onChange: setQ, placeholder: t("Search a name", "ابحث عن اسم") } : undefined}
      filters={kind ? <FilterChips value={show} onChange={setShow} filters={[{ key: "ALL", label: t("All", "الكل"), count: all.length }, { key: "UNREAD", label: t("Unread", "غير مقروءة"), count: all.filter(x => x.unread > 0).length }]} /> : undefined}
      items={rows} keyOf={x => x.id} rowHeight={72}
      renderItem={x => <ThreadRow name={x.name} at={x.at} unread={x.unread} onPress={() => go(`/dept/thread/${kind}/${x.id}`)} status={<GStatusChip {...appStatus(x.status, t)} />}
        last={`${x.lastFrom === "ADMIN" ? t("You: ", "أنت: ") : ""}${(x.last.split("||")[isArabic && x.last.includes("||") ? 1 : 0] ?? "").trim()}`} />}
      loading={!!kind && !state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: !kind ? t("Mechanic applications are handled in the Requests tab.", "تُعالج طلبات الميكانيكيين في تبويب الطلبات.") : q || show !== "ALL" ? t("No conversation matches.", "لا توجد محادثة مطابقة.") : t("No conversations yet. A conversation starts when an owner submits or writes to you.", "لا توجد محادثات بعد. تبدأ المحادثة عند إرسال المالك طلبه أو مراسلتك.") }}
      onRefresh={() => void state.reload()} refreshing={false}
      detailHint={t("Tap a conversation to open it.", "اضغط على محادثة لفتحها.")} />
  );
}

/** One thread with an applicant, from the department side (Inbox thread). */
export function DeptThread({ kind, id }: { kind: Kind; id: string }) {
  const { t } = useL();
  const app = useLoad(() => review.get(kind, id), [kind, id]);
  const load = useCallback(() => review.messages(kind, id), [kind, id]);
  const markRead = useCallback(() => review.markRead(kind, id), [kind, id]);
  const send = useCallback((b: string, a?: Attachment) => review.send(kind, id, b, a), [kind, id]);
  const name = app.data?.info.name ?? t("Messages", "الرسائل");
  return (
    <ThreadPage title={name} line={app.data ? `${app.data.owner.fullName} · ${kindLabel(t, kind)}` : undefined}
      badge={app.data ? <GStatusChip {...appStatus(app.data.status, t)} /> : undefined}
      mine="ADMIN" names={{ me: "MOTEXA", other: app.data?.owner.fullName ?? name }} load={load} markRead={markRead} send={send} />
  );
}

/** The one review route. company / shop = application review; truck = the vehicle; mechanic = the mechanic application (id = its user). */
export function ReviewScreen({ kind, id }: { kind: ReviewKind; id: string }) {
  if (kind === "mechanic") return <MechanicApplicationReview userId={id} />;
  if (kind === "company") return <NewApplicationReview kind="TOW" id={id} />;
  if (kind === "shop") return <NewApplicationReview kind="PARTS" id={id} />;
  if (kind === "garage") return <NewApplicationReview kind="GARAGE" id={id} />;
  if (kind === "truck") return <TruckReview id={id} />;
  return null;
}
