// The four department tabs. They read the ACTIVE department's config (departments.ts) and nothing else.
import { Ionicons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { ReactNode, useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import InteractiveButton from "../../components/InteractiveButton";
import MechanicReviewScreen from "../../components/MechanicReviewScreen";
import { Text } from "../../components/MotexaVisual";
import { useLoad } from "../../core/hooks/useLoad";
import { useDepartment } from "./DepartmentContext";
import { Row, Status } from "./departments";
import { ApplicationsList } from "./applications";
import { DeptHero, DeptPage, Empty, ItemCard, Load, MenuCard, Pill, Section, StatRow, StatTile, StatusPill, useDT } from "./ui";

const go = (path: string) => router.push(path as Href);

// ---------------------------------------------------------------- Home
export function DeptHome() {
  const { active } = useDepartment();
  const d = useDT();
  const stats = useLoad(() => active.loadStats(), [active.key]);
  const value = (key: string) => (stats.loading && !stats.data ? "…" : stats.data ? String(stats.data[key] ?? 0) : "—");
  const pending = stats.data ? active.stats.filter((s) => s.warn).reduce((n, s) => n + (stats.data?.[s.key] ?? 0), 0) : 0;
  return (
    <DeptPage
      onRefresh={() => void stats.reload()}
      refreshing={stats.loading && !!stats.data}
      hero={<DeptHero image={active.hero} greeting={d.t("Welcome back", "مرحبًا بعودتك")} title={d.t(active.en, active.ar)} subtitle={d.t(active.blurbEn, active.blurbAr)} />}
    >
      <Section title={d.t("Overview", "نظرة عامة")} />
      <StatRow>
        {active.stats.map((s) => (
          <StatTile key={s.key} icon={s.icon} value={value(s.key)} label={d.t(s.en, s.ar)} tone={s.warn && Number(stats.data?.[s.key]) > 0 ? "warn" : undefined} />
        ))}
      </StatRow>
      {stats.error && !stats.data ? (
        <Text accessibilityRole="alert" style={{ color: d.muted, fontSize: 12, lineHeight: 20, marginBottom: 14, textAlign: d.align }}>
          {d.t("Statistics could not load. Pull down to try again.", "تعذّر تحميل الإحصاءات. اسحب للأسفل للمحاولة مجددًا.")}
        </Text>
      ) : null}
      <Section title={d.t("Shortcuts", "اختصارات")} />
      <View style={{ padding: 11, borderRadius: 28, borderWidth: 1, borderColor: d.dark ? "#61472F" : "#EBD6B9", backgroundColor: d.dark ? "#32241B" : "#F7EBD9" }}>
        {active.shortcuts.map((sc) => (
          <MenuCard
            key={sc.id}
            title={d.t(sc.en, sc.ar)}
            description={d.t(sc.descEn, sc.descAr)}
            icon={sc.icon}
            photo={sc.photo}
            badge={sc.id === "requests" && pending > 0 ? String(pending) : undefined}
            onPress={() => go(sc.id === "requests" ? "/dept/requests" : "/dept/directory")}
          />
        ))}
        <MenuCard title={d.t("My Profile", "ملفي الشخصي")} description={d.t("Your account details and access", "بيانات حسابك وصلاحياتك")} icon="person-outline" photo={0} onPress={() => go("/dept/profile")} />
      </View>
      <Text style={{ fontSize: 8, lineHeight: 16, letterSpacing: 1, textAlign: "center", marginTop: 20, color: d.muted }}>MOTEXA • {active.en.toUpperCase()} ADMIN</Text>
    </DeptPage>
  );
}

// ---------------------------------------------------------------- lists
function RowCard({ row, onPress, children }: { row: Row; onPress?: () => void; children?: ReactNode }) {
  const d = useDT();
  return (
    <ItemCard label={row.title} onPress={onPress}>
      <Text numberOfLines={2} style={{ color: d.ink, fontSize: 15, lineHeight: 22, fontWeight: "600", textAlign: d.align }}>{row.title}</Text>
      {row.subtitle ? <Text numberOfLines={2} style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align }}>{row.subtitle}</Text> : null}
      <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {row.status ? <StatusPill value={row.status} /> : null}
        {row.meta.map((m, i) => (
          <Pill key={i} label={m} tone={/pending|قيد/.test(m) ? "warn" : "neutral"} />
        ))}
      </View>
      {children}
    </ItemCard>
  );
}

// a mechanic opens in Diala's review screen (the Requests tab); company / shop open the application review
const openRow = (r: Row) => (r.kind === "mechanic" ? () => go("/dept/requests") : () => go(`/dept/review/${r.kind}/${r.id}`));

export function DeptRequests() {
  const { active } = useDepartment();
  // towing / parts: the applications (New, Needs changes, Approved, Rejected); mechanics: Diala's review screen
  return active.provider && active.requests.mode === "applications" ? <ApplicationsList kind={active.provider} /> : <MechanicReviewScreen />;
}

type Filter = "ALL" | Status;

export function DeptDirectory() {
  const { active } = useDepartment();
  const d = useDT();
  const cfg = active.directory;
  const state = useLoad(() => cfg.load(d.t), [active.key, d.ar]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const hasStatus = active.key !== "MANAGE_MECHANICS";
  const text = (r: Row): string => [r.title, r.subtitle, ...r.meta, ...(r.children ?? []).map(text)].join(" ").toLowerCase();
  const filters: { k: Filter; en: string; ar: string }[] = [
    { k: "ALL", en: "All", ar: "الكل" },
    { k: "PENDING", en: "Submitted", ar: "مُرسل" },
    { k: "NEEDS_CHANGES", en: "Needs changes", ar: "تعديلات" },
    { k: "APPROVED", en: "Approved", ar: "معتمد" },
    { k: "REJECTED", en: "Rejected", ar: "مرفوض" },
  ];
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (state.data ?? []).filter((r) => (filter === "ALL" || r.status === filter) && (!needle || text(r).includes(needle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data, q, filter]);
  return (
    <DeptPage onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}>
      <Section title={d.t(cfg.titleEn, cfg.titleAr)} caption={d.t(active.en, active.ar)} />
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: d.border, backgroundColor: d.dark ? "#3A2E24" : "#FFF8ED", paddingHorizontal: 14, marginBottom: 12 }}>
        <Ionicons name="search-outline" size={20} color={d.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={d.t(cfg.searchEn, cfg.searchAr)}
          placeholderTextColor={d.muted}
          accessibilityLabel={d.t(cfg.searchEn, cfg.searchAr)}
          style={{ flex: 1, minHeight: 46, color: d.ink, textAlign: d.align }}
        />
      </View>
      {hasStatus ? (
        <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {filters.map((f) => (
            <InteractiveButton
              key={f.k}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.k }}
              onPress={() => setFilter(f.k)}
              style={{ paddingHorizontal: 14, minHeight: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: filter === f.k ? "#E0A36F" : d.border, backgroundColor: filter === f.k ? "#E0A36F" : "transparent" }}
            >
              <Text style={{ color: filter === f.k ? "#332218" : d.ink, fontSize: 13, fontWeight: "600" }}>{d.t(f.en, f.ar)}</Text>
            </InteractiveButton>
          ))}
        </View>
      ) : null}
      <Load state={state}>
        {() =>
          rows.length === 0 ? (
            <Empty icon="search-outline" text={q || filter !== "ALL" ? d.t("Nothing matches.", "لا توجد نتائج مطابقة.") : d.t(cfg.emptyEn, cfg.emptyAr)} />
          ) : (
            <>
              {rows.map((r) => (
                <RowCard key={`${r.kind}-${r.id}`} row={r} onPress={openRow(r)}>
                  {r.children?.length ? (
                    <View style={{ marginTop: 10 }}>
                      <InteractiveButton
                        accessibilityRole="button"
                        accessibilityState={{ expanded: !!open[r.id] }}
                        onPress={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                        style={{ flexDirection: d.row, alignItems: "center", gap: 6, minHeight: 36 }}
                      >
                        <Ionicons name={open[r.id] ? "chevron-up" : "chevron-down"} size={16} color={d.accent} />
                        <Text style={{ color: d.accent, fontSize: 12, fontWeight: "600" }}>{d.t("Trucks", "الشاحنات")} ({r.children.length})</Text>
                      </InteractiveButton>
                      {open[r.id]
                        ? r.children.map((c) => (
                            <InteractiveButton
                              key={c.id}
                              accessibilityRole="button"
                              accessibilityLabel={c.title}
                              onPress={() => go(`/dept/review/${c.kind}/${c.id}`)}
                              style={{ borderTopWidth: 1, borderTopColor: d.border, paddingVertical: 10, gap: 6 }}
                            >
                              <Text numberOfLines={1} style={{ color: d.ink, fontSize: 13, fontWeight: "600", textAlign: d.align }}>{c.title}</Text>
                              <View style={{ flexDirection: d.row, flexWrap: "wrap", gap: 6 }}>
                                {c.status ? <StatusPill value={c.status} /> : null}
                                {c.meta.map((m, i) => (
                                  <Pill key={i} label={m} />
                                ))}
                              </View>
                            </InteractiveButton>
                          ))
                        : null}
                    </View>
                  ) : null}
                </RowCard>
              ))}
            </>
          )
        }
      </Load>
    </DeptPage>
  );
}
