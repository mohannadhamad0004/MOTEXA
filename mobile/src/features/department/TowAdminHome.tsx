// Tow Admin dashboard (the Towing department Home). Real data only: counts from GET /admin/tow/stats, trucks and companies from
// GET /admin/tow/trucks + /companies, applications from the provider review list. Nothing here is invented: trucks report no live
// position, so Fleet status is a list (status, type, company), not a map. Every row opens a screen that already exists.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useFocusEffect } from "expo-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import InteractiveButton from "../../components/InteractiveButton";
import { Text } from "../../components/MotexaVisual";
import { MoTowAdminVideo, MOTOW_ASPECT } from "../../components/blueprint/mascot/MoTowAdminVideo";
import { api } from "../../core/config/api";
import { cityLabel } from "../../core/constants/cities";
import { useLoad } from "../../core/hooks/useLoad";
import { useReduced } from "../../motion";
import { review } from "../provider/api";
import { fmtDay } from "../provider/labels";
import { towAdminService } from "../tow/towService";
import type { Truck } from "../tow/towService";
import { truckTypeLabel } from "./departments";
import { Avatar, DeptPage, Empty, Pill, StatusChip, cardStyle, useDT } from "./ui";

type IconName = keyof typeof Ionicons.glyphMap;
const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const ltr = (v: string) => "⁦" + v + "⁩";

/** a card rising 10 px as it appears, staggered 40 ms by its position; reduced motion = no movement */
export function Rise({ i, children, style }: { i: number; children: ReactNode; style?: object }) {
  const reduced = useReduced();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(i * 40, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 10 }] }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}

/** a pressable card that settles to 0.98 while pressed */
export function Tap({ label, onPress, style, children }: { label: string; onPress: () => void; style?: object; children: ReactNode }) {
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={st}>
      <InteractiveButton
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => (s.value = withTiming(0.98, { duration: 90 }))}
        onPressOut={() => (s.value = withTiming(1, { duration: 140 }))}
        style={style}
      >
        {children}
      </InteractiveButton>
    </Animated.View>
  );
}

/** Dark in both themes: eyebrow, title and one line on the start side, Mo's desk on the end side (never mirrored). */
function Hero() {
  const d = useDT();
  const { width } = useWindowDimensions();
  // plays on every real focus of the dashboard (never on rerenders or refreshes) and again when Mo is tapped
  const [playKey, setPlayKey] = useState(0);
  useFocusEffect(useCallback(() => setPlayKey((k) => k + 1), []));
  const moW = Math.round(Math.min(190, Math.max(150, width * 0.45)));
  return (
    <LinearGradient colors={["#1B130E", "#2B1E15", "#3A2818"]} style={{ borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 }}>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "#E0A36F", fontSize: 11, lineHeight: 16, fontWeight: "700", letterSpacing: d.ar ? 0 : 2, textAlign: d.align }}>{d.t("TOW TRUCKS", "شاحنات السحب")}</Text>
          <Text style={{ color: "#FFF1DF", fontSize: 34, lineHeight: d.ar ? 52 : 42, fontWeight: "800", textAlign: d.align }}>{d.t("Admin", "الإدارة")}</Text>
          <Text style={{ color: "#DCC7A8", fontSize: 13, lineHeight: 20, marginTop: 4, textAlign: d.align }}>{d.t("Manage fleet, requests and tow providers.", "أدِر الأسطول والطلبات ومزوّدي السحب.")}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={d.t("Replay Mo", "إعادة تشغيل مو")} onPress={() => setPlayKey((k) => k + 1)} style={({ pressed }) => ({ width: moW, height: moW * MOTOW_ASPECT, opacity: pressed ? 0.92 : 1 })}>
          <MoTowAdminVideo width={moW} play={playKey > 0} playKey={playKey} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

export function Kpi({ i, icon, value, label, onPress, warn }: { i: number; icon: IconName; value: string; label: string; onPress: () => void; warn?: boolean }) {
  const d = useDT();
  return (
    <Rise i={i} style={{ width: "48.4%" }}>
      <Tap label={`${label}: ${value}`} onPress={onPress} style={{ ...cardStyle(d, warn ? "warn" : undefined), padding: 14, minHeight: 104, justifyContent: "space-between" }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: d.soft, alignSelf: d.ar ? "flex-end" : "flex-start" }}>
          <Ionicons name={icon} size={19} color={d.accent} />
        </View>
        <View>
          <Text style={{ color: d.ink, fontSize: 28, lineHeight: 34, fontWeight: "800", textAlign: d.align }}>{value}</Text>
          <Text numberOfLines={2} style={{ color: d.muted, fontSize: 12, lineHeight: 17, textAlign: d.align }}>{label}</Text>
        </View>
      </Tap>
    </Rise>
  );
}

export function Head({ title, caption, action, onAction }: { title: string; caption?: string; action?: string; onAction?: () => void }) {
  const d = useDT();
  return (
    <View style={{ flexDirection: d.row, alignItems: "flex-end", gap: 10, marginTop: 8, marginBottom: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: d.ink, fontSize: 19, lineHeight: d.ar ? 30 : 26, fontWeight: "700", textAlign: d.align }}>{title}</Text>
        {caption ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{caption}</Text> : null}
      </View>
      {action && onAction ? (
        <InteractiveButton accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={{ flexDirection: d.row, alignItems: "center", gap: 4, minHeight: 36, paddingHorizontal: 4 }}>
          <Text style={{ color: d.accent, fontSize: 13, fontWeight: "700" }}>{action}</Text>
          <Ionicons name={d.ar ? "chevron-back" : "chevron-forward"} size={15} color={d.accent} />
        </InteractiveButton>
      ) : null}
    </View>
  );
}

export function Skeleton({ n }: { n: number }) {
  const d = useDT();
  return (
    <>
      {Array.from({ length: n }, (_, k) => (
        <View key={k} style={{ ...cardStyle(d), height: 72, marginBottom: 10, opacity: 0.55 }} />
      ))}
    </>
  );
}

const truckState = (t: Truck, tr: (en: string, ar: string) => string) =>
  t.hasActiveJob
    ? { tone: "bronze" as const, icon: "navigate-outline" as IconName, label: tr("On a job", "في مهمة") }
    : t.operational === "AVAILABLE"
      ? { tone: "ok" as const, icon: "checkmark-circle-outline" as IconName, label: tr("Available", "متاح") }
      : t.operational === "BUSY"
        ? { tone: "amber" as const, icon: "time-outline" as IconName, label: tr("Busy", "مشغول") }
        : { tone: "neutral" as const, icon: "remove-circle-outline" as IconName, label: tr("Out of service", "خارج الخدمة") };

export function TowAdminHome() {
  const d = useDT();
  const stats = useLoad(async () => api<{ stats: Record<string, number> }>("GET", "/admin/tow/stats").then((r) => r.stats), []);
  const fleet = useLoad(async () => {
    const [companies, trucks] = await Promise.all([towAdminService.listCompanies(NOACTOR), towAdminService.listTrucks(NOACTOR)]);
    return { companies, trucks };
  }, []);
  const recent = useLoad(() => review.list("TOW", "NEW"), [], 15000);

  const approved = fleet.data?.trucks.filter((t) => t.verification === "APPROVED") ?? [];
  const num = (v: number | undefined, ready: boolean) => (ready ? String(v ?? 0) : stats.loading || fleet.loading ? "…" : "—");
  const toReview = stats.data ? (stats.data.pendingCompanies ?? 0) + (stats.data.pendingTrucks ?? 0) : undefined;
  const companyName = new Map((fleet.data?.companies ?? []).map((c) => [c.id, c.name]));
  // trucks on a job first, then available, then the rest
  const rank = (t: Truck) => (t.hasActiveJob ? 0 : t.operational === "AVAILABLE" ? 1 : t.operational === "BUSY" ? 2 : 3);
  const fleetRows = [...approved].sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  const companies = [...(fleet.data?.companies ?? [])].sort((a, b) => Number(b.verification === "APPROVED") - Number(a.verification === "APPROVED")).slice(0, 3);
  const reload = () => (void stats.reload(), void fleet.reload(), void recent.reload());

  return (
    <DeptPage hero={<Hero />} onRefresh={reload} refreshing={(stats.loading || fleet.loading || recent.loading) && !!(stats.data || fleet.data)}>
      <View style={{ flexDirection: d.row, flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginBottom: 22 }}>
        <Kpi i={0} icon="checkmark-circle-outline" value={num(approved.filter((t) => t.operational === "AVAILABLE" && !t.hasActiveJob).length, !!fleet.data)} label={d.t("Available trucks", "شاحنات متاحة")} onPress={() => go("/dept/directory")} />
        <Kpi i={1} icon="navigate-outline" value={num(approved.filter((t) => t.hasActiveJob).length, !!fleet.data)} label={d.t("Trucks on a job", "شاحنات في مهمة")} onPress={() => go("/dept/directory")} />
        <Kpi i={2} icon="clipboard-outline" value={num(toReview, !!stats.data)} label={d.t("Waiting for review", "بانتظار المراجعة")} warn={!!toReview} onPress={() => go("/dept/requests")} />
        <Kpi i={3} icon="business-outline" value={num(stats.data?.approvedCompanies, !!stats.data)} label={d.t("Tow companies", "شركات السحب")} onPress={() => go("/dept/directory")} />
      </View>

      <Head title={d.t("Fleet status", "حالة الأسطول")} caption={d.t("Approved trucks. Live positions are not reported.", "الشاحنات المعتمدة. المواقع المباشرة غير متاحة.")} action={d.t("All", "الكل")} onAction={() => go("/dept/directory")} />
      {fleet.data ? (
        fleetRows.length === 0 ? (
          <Empty icon="car-outline" text={d.t("No approved trucks yet.", "لا توجد شاحنات معتمدة بعد.")} hint={d.t("Trucks appear here once a company's truck is approved.", "تظهر الشاحنات هنا بعد اعتماد شاحنة الشركة.")} />
        ) : (
          fleetRows.map((t, i) => {
            const st = truckState(t, d.t);
            return (
              <Rise key={t.id} i={4 + i}>
                <Tap label={`${truckTypeLabel(d.t, t.type)} ${t.plate}`} onPress={() => go(`/dept/review/truck/${t.id}`)} style={{ ...cardStyle(d), padding: 14, marginBottom: 10 }}>
                  <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: d.soft }}>
                      <Ionicons name="car-sport-outline" size={22} color={d.accent} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{`${truckTypeLabel(d.t, t.type)} · ${ltr(t.plate)}`}</Text>
                      <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{[companyName.get(t.companyId), [t.make, t.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: d.row, marginTop: 10 }}>
                    <Pill tone={st.tone} icon={st.icon} label={st.label} />
                  </View>
                </Tap>
              </Rise>
            );
          })
        )
      ) : fleet.loading ? (
        <Skeleton n={2} />
      ) : (
        <Empty icon="cloud-offline-outline" text={fleet.error || d.t("Something went wrong.", "حدث خطأ ما.")} hint={d.t("Pull down to try again.", "اسحب للأسفل للمحاولة مجددًا.")} />
      )}

      <View style={{ height: 14 }} />
      <Head title={d.t("Recent requests", "أحدث الطلبات")} caption={d.t("Applications waiting for review", "طلبات بانتظار المراجعة")} action={d.t("All", "الكل")} onAction={() => go("/dept/requests")} />
      {recent.data ? (
        recent.data.length === 0 ? (
          <Empty icon="checkmark-done-outline" text={d.t("No application is waiting for review.", "لا يوجد طلب بانتظار المراجعة.")} />
        ) : (
          recent.data.slice(0, 3).map((r, i) => (
            <Rise key={r.id} i={8 + i}>
              <Tap label={r.name} onPress={() => go(`/dept/review/company/${r.id}`)} style={{ ...cardStyle(d), padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                  <Avatar name={r.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{r.name}</Text>
                    <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>{r.ownerName} · {cityLabel(r.city, d.ar)}</Text>
                  </View>
                  <Ionicons name={d.ar ? "chevron-back" : "chevron-forward"} size={18} color={d.accent} />
                </View>
                <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  <StatusChip status={r.status} />
                  {r.submittedAt ? <Pill icon="calendar-outline" label={fmtDay(r.submittedAt)} /> : null}
                  {r.pendingDocuments ? <Pill tone="amber" icon="document-text-outline" label={`${r.pendingDocuments} ${d.t("documents waiting", "مستندات بانتظار المراجعة")}`} /> : null}
                </View>
              </Tap>
            </Rise>
          ))
        )
      ) : recent.loading ? (
        <Skeleton n={2} />
      ) : (
        <Empty icon="cloud-offline-outline" text={recent.error || d.t("Something went wrong.", "حدث خطأ ما.")} hint={d.t("Pull down to try again.", "اسحب للأسفل للمحاولة مجددًا.")} />
      )}

      <View style={{ height: 14 }} />
      <Head title={d.t("Tow companies", "شركات السحب")} action={d.t("All", "الكل")} onAction={() => go("/dept/directory")} />
      {fleet.data ? (
        companies.length === 0 ? (
          <Empty icon="business-outline" text={d.t("No tow companies yet.", "لا توجد شركات سحب بعد.")} />
        ) : (
          companies.map((c, i) => (
            <Rise key={c.id} i={11 + i}>
              <Tap label={c.name} onPress={() => go(`/dept/review/company/${c.id}`)} style={{ ...cardStyle(d), padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
                  <Avatar name={c.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: d.align }}>{c.name}</Text>
                    <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, lineHeight: 18, textAlign: d.align }}>
                      {[cityLabel(c.city, d.ar), `${c.truckCount} ${c.truckCount === 1 ? d.t("truck", "شاحنة") : d.t("trucks", "شاحنات")}`].join(" · ")}
                    </Text>
                  </View>
                  <StatusChip status={c.verification} />
                </View>
              </Tap>
            </Rise>
          ))
        )
      ) : fleet.loading ? (
        <Skeleton n={2} />
      ) : null}

      <Text style={{ fontSize: 8, lineHeight: 16, letterSpacing: 1, textAlign: "center", marginTop: 14, color: d.muted }}>MOTEXA • TOWING ADMIN</Text>
    </DeptPage>
  );
}
