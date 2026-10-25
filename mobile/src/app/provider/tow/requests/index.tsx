import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { CrossFade, Flash, PrimaryButton, Tag } from "../../../../components/blueprint";
import { DashboardLayout } from "../../../../components/layout/DashboardLayout";
import { Card } from "../../../../components/ui/Card";
import { Segmented } from "../../../../components/ui/Chip";
import { Async, EmptyState, Notice } from "../../../../components/ui/Feedback";
import { Text } from "../../../../components/ui/Text";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { TowStatusBadge, fmtDateTime, useProblemLabels } from "../../../../features/requests/requestBits";
import { CompanyTowRequest, TowStatus, companyTowRequests } from "../../../../features/requests/requestsService";
import { asActor, useSessionUser } from "../../../../features/shared/session";
import { towFleetService } from "../../../../features/tow/towService";
import { useTruckLabels } from "../../../../features/tow/truckBits";
import { M, closeMs, hapticError, hapticSuccess } from "../../../../motion";
import { useTheme } from "../../../../theme/useTheme";
import { Button } from "../../../../components/ui/Button";

type Filter = "ALL" | "NEW" | "ACTIVE" | "DONE";
// Filters group the statuses a company thinks in: waiting for an answer, on a job, finished.
const GROUPS: Record<Exclude<Filter, "ALL">, TowStatus[]> = {
  NEW: ["REQUESTED"],
  ACTIVE: ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"],
  DONE: ["COMPLETED", "DECLINED", "CANCELLED"],
};

type Section = "current" | "new" | "active" | "done";
type Item = { kind: "head"; key: string; section: Section } | { kind: "card"; key: string; r: CompanyTowRequest };

/**
 * One flat list (stable keys) so a card that changes section really MOVES: Current job (the most recently updated job
 * the company holds), New, Active (the other accepted jobs), Finished.
 */
function arrange(list: CompanyTowRequest[]): Item[] {
  const held = list.filter((r) => GROUPS.ACTIVE.includes(r.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sections: Record<Section, CompanyTowRequest[]> = {
    current: held.slice(0, 1),
    new: list.filter((r) => r.status === "REQUESTED"),
    active: held.slice(1),
    done: list.filter((r) => GROUPS.DONE.includes(r.status)),
  };
  const out: Item[] = [];
  (["current", "new", "active", "done"] as Section[]).forEach((s) => {
    if (!sections[s].length) return;
    out.push({ kind: "head", key: `head-${s}`, section: s });
    for (const r of sections[s]) out.push({ kind: "card", key: r.id, r });
  });
  return out;
}

export default function CompanyRequests() {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  const problem = useProblemLabels();
  const { type } = useTruckLabels();
  const user = useSessionUser();
  const [filter, setFilter] = useState<Filter>("ALL");
  const state = useLoad(() => companyTowRequests.list(), []);
  const fleet = useLoad(() => towFleetService.getMyFleet(asActor(user)), [user.id]);

  // answers of this screen that the next list read has not caught up with yet
  const [local, setLocal] = useState<Record<string, CompanyTowRequest>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [truckId, setTruckId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const seen = useRef(state.data);
  useEffect(() => {
    if (state.data !== seen.current) {
      seen.current = state.data;
      setLocal({});
    }
  }, [state.data]);

  const sectionTitle: Record<Section, string> = {
    current: t("Current job", "المهمة الحالية"),
    new: t("New", "جديدة"),
    active: t("Active", "نشطة"),
    done: t("Finished", "منتهية"),
  };
  const available = (fleet.data?.trucks ?? []).filter((x) => x.verification === "APPROVED" && x.operational === "AVAILABLE");

  const accept = async (id: string) => {
    if (!truckId) return;
    setBusy(id);
    setErr(null);
    try {
      const r = await companyTowRequests.accept(id, truckId);
      hapticSuccess();
      setLocal((cur) => ({ ...cur, [id]: r }));
      setPicking(null);
      setTruckId(null);
      setFlash(id);
      setTimeout(() => setFlash((f) => (f === id ? null : f)), 1400);
      state.reload();
      fleet.reload(); // the truck is no longer free
    } catch (e: any) {
      hapticError();
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const ms = M.detail;
  return (
    <DashboardLayout tag="REQUESTS / T2" brand="MOTEXA TOW" title={t("Tow requests", "طلبات السحب")} subtitle={t("Requests from customers", "طلبات من العملاء")} back>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { key: "ALL", label: t("All", "الكل") },
          { key: "NEW", label: t("New", "جديدة") },
          { key: "ACTIVE", label: t("Active", "نشطة") },
          { key: "DONE", label: t("Finished", "منتهية") },
        ]}
      />
      <Async state={state}>
        {(raw) => {
          const all = raw.map((r) => local[r.id] ?? r);
          const list = filter === "ALL" ? all : all.filter((r) => GROUPS[filter].includes(r.status));
          if (!list.length) return <EmptyState icon="navigate-outline" text={t("No requests here.", "لا توجد طلبات هنا.")} />;
          return (
            <View>
              {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
              {arrange(list).map((it) =>
                it.kind === "head" ? (
                  <Animated.View key={it.key} layout={LinearTransition.duration(ms)} entering={FadeIn.duration(M.chip)} exiting={FadeOut.duration(closeMs(M.chip))} style={{ marginTop: 6, marginBottom: 8 }}>
                    <Tag color={col.textMuted}>{sectionTitle[it.section]}</Tag>
                  </Animated.View>
                ) : (
                  <Animated.View key={it.key} layout={LinearTransition.duration(ms)} entering={FadeIn.duration(M.chip)} exiting={FadeOut.duration(closeMs(M.chip))}>
                    <Card label={it.r.customerName} onPress={() => router.push(`/provider/tow/requests/${it.r.id}`)}>
                      <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{it.r.customerName}</Text>
                          <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                            {it.r.vehicle.make} {it.r.vehicle.model} · {problem[it.r.problemType]}
                          </Text>
                        </View>
                        <CrossFade k={it.r.status}>
                          <TowStatusBadge value={it.r.status} />
                        </CrossFade>
                      </View>
                      <Text numberOfLines={1} style={[{ color: col.textDim, fontSize: 12, marginTop: 10 }, align]}>{it.r.pickupAddress}</Text>
                      <Text style={[{ color: col.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(it.r.updatedAt)}</Text>
                      {it.r.status === "REQUESTED" && picking !== it.r.id ? (
                        <View style={{ marginTop: 12 }}>
                          <PrimaryButton label={t("Accept", "قبول")} icon="check" onPress={() => { setPicking(it.r.id); setTruckId(null); setErr(null); }} />
                        </View>
                      ) : null}
                      {it.r.status === "REQUESTED" && picking === it.r.id ? (
                        <View style={{ marginTop: 12, gap: 8 }}>
                          <Text style={[{ color: col.text, fontSize: 13, fontWeight: "800" }, align]}>{t("Choose a truck", "اختر شاحنة")}</Text>
                          {!available.length ? (
                            <Notice icon="alert-circle-outline">{t("You have no approved, available truck. Set one available first.", "لا توجد لديك شاحنة معتمدة ومتاحة. اجعل إحداها متاحة أولًا.")}</Notice>
                          ) : (
                            available.map((tr) => (
                              <Button
                                key={tr.id}
                                variant={truckId === tr.id ? "primary" : "ghost"}
                                icon={truckId === tr.id ? "radio-button-on" : "radio-button-off"}
                                label={`${type[tr.type]} · ${tr.make} ${tr.model} · ${tr.plate}`}
                                onPress={() => setTruckId(tr.id)}
                              />
                            ))
                          )}
                          <PrimaryButton label={t("Confirm and accept", "تأكيد والقبول")} loading={busy === it.r.id} road disabled={!truckId} onPress={() => accept(it.r.id)} />
                          <PrimaryButton variant="outline" label={t("Back", "رجوع")} disabled={busy === it.r.id} onPress={() => { setPicking(null); setTruckId(null); }} />
                        </View>
                      ) : null}
                      <Flash active={flash === it.r.id} radius={16} />
                    </Card>
                  </Animated.View>
                )
              )}
            </View>
          );
        }}
      </Async>
    </DashboardLayout>
  );
}
