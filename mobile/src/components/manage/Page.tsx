// ONE page frame for every provider / admin screen (docs/guide/10-ui-system.md). Top: ← back + the trail ("Parts admin › 3D models ›
// W202 import"); then the title block (title, one short line, ⋮); then the page; an optional sticky footer with the page's ONE primary
// action. Dashboards pass a `hero` instead of the top bar. Also the small Detail / Dashboard pieces: facts rows, blocks, KPI tiles.
import { router, usePathname, type Href } from "expo-router";
import { createContext, useContext, useState, type ReactNode, type RefObject } from "react";
import { Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useL } from "../../core/hooks/useL";
import { areaRoot, crumbsFor, type Crumb } from "../../core/nav/crumbs";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { ErrorState, GButton, GIcon, GText, Note, SkeletonRows, StatusChip, type GIconName } from "../garage";
import { signOut } from "../../core/session/session";
import { useDocViewer } from "../../features/provider/ui";
import { ItemActionsMenu, ToastHost, type ItemAction } from "../ItemActionsMenu";

/** What an area adds to its pages: its root crumb (the department's own name) and a row under the top bar on its home tabs (the department switcher). */
type Area = { root?: Crumb; top?: ReactNode };
const AreaContext = createContext<Area>({});
export function AreaProvider({ value, children }: { value: Area; children: ReactNode }) {
  return <AreaContext.Provider value={value}>{children}</AreaContext.Provider>;
}

/** The trail of the current page: area root › labelled parents (› `extra`) › the page itself. */
export function useTrail(title: string, extra: Crumb[] = []) {
  const path = usePathname();
  const area = useContext(AreaContext);
  const root = area.root ?? areaRoot(path);
  return { root, crumbs: [root, ...crumbsFor(path), ...extra], title };
}

/** The title block: the title (max 2 lines), one short line and an optional ⋮ with the page's secondary tasks. */
export function ManageHeader({ title, line, actions }: { title: string; line?: string; actions?: ItemAction[] }) {
  const { row, align } = useGarageTheme();
  return (
    <View style={[row, { alignItems: "flex-start", gap: 8 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText accessibilityRole="header" numberOfLines={2} style={[gType.display, align, { fontSize: 24, lineHeight: 31 }]}>{title}</GText>
        {line ? <GText soft numberOfLines={1} style={[gType.caption, align, { marginTop: 2 }]}>{line}</GText> : null}
      </View>
      {actions?.length ? <ItemActionsMenu title={title} actions={actions} /> : null}
    </View>
  );
}

const goBack = (fallback: string) => { if (router.canGoBack()) router.back(); else router.replace(fallback as Href); };

/** ← back (44 px) and the trail on one line. Tapping a crumb returns to that page (popped from the history when it is there). */
function TopBar({ back, title, extra }: { back: boolean; title: string; extra?: Crumb[] }) {
  const { t, isArabic } = useL();
  const { g, row } = useGarageTheme();
  const insets = useSafeAreaInsets();
  const { crumbs } = useTrail(title, extra);
  const parent = crumbs[crumbs.length - 1]!.href;
  return (
    <View style={[row, { paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 4, alignItems: "center", gap: 6 }]}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t("Back", "رجوع")} onPress={() => goBack(parent)} hitSlop={4}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: g.line, backgroundColor: pressed ? g.tint : g.card })}>
          <GIcon name={isArabic ? "chevron-forward" : "chevron-back"} size={22} />
        </Pressable>
      ) : null}
      {back ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={[row, { alignItems: "center", flexGrow: 1 }]}>
          {crumbs.map((c, i) => (
            <View key={`${c.href}-${i}`} style={[row, { alignItems: "center" }]}>
              <Pressable accessibilityRole="link" accessibilityLabel={`${t("Go to", "الانتقال إلى")} ${t(c.en, c.ar)}`} onPress={() => router.dismissTo(c.href as Href)}
                style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}>
                <GText numberOfLines={1} style={[gType.caption, { maxWidth: 150, color: g.accentText, fontWeight: "700" }]}>{t(c.en, c.ar)}</GText>
              </Pressable>
              <GText soft style={[gType.caption, { paddingHorizontal: 2 }]}>{isArabic ? "‹" : "›"}</GText>
            </View>
          ))}
          <GText soft numberOfLines={1} style={[gType.caption, { maxWidth: 180, paddingHorizontal: 4 }]}>{title}</GText>
        </ScrollView>
      ) : null}
    </View>
  );
}

/**
 * The frame. Scroll mode (default): title block + children in a ScrollView with pull-to-refresh. `list`: the children bring their own
 * virtualized list and render the title block themselves (ManagePage). `hero`: a dashboard; the hero replaces top bar and title.
 */
export function Page({ title, line, actions, back = true, children, footer, onRefresh, refreshing, list = false, maxWidth = 760, hero, tabBar = false, trail, scrollRef }: {
  title: string; line?: string; actions?: ItemAction[];
  /** false on tab roots */
  back?: boolean;
  children: ReactNode;
  /** sticky bottom bar: the page's ONE primary action (or a bulk bar) */
  footer?: ReactNode;
  onRefresh?: () => void; refreshing?: boolean;
  list?: boolean; maxWidth?: number;
  hero?: ReactNode;
  /** the page sits above the floating tab bar */
  tabBar?: boolean;
  /** crumbs between the URL's parents and this page (a sub-view on the same URL, e.g. an editor opened with ?key=) */
  trail?: Crumb[];
  /** the page's ScrollView (scroll mode), for pages that jump to a field */
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const { g, dark } = useGarageTheme();
  const area = useContext(AreaContext);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const top = hero ? hero : <TopBar back={back} title={title} extra={trail} />;
  const areaRow = !back && area.top ? area.top : null;
  const pad = footer ? 200 : tabBar ? 130 : 40;
  return (
    <View style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: g.page }]} />
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      {list ? (
        <View style={{ flex: 1, width: "100%", maxWidth, alignSelf: "center" }}>
          {top}
          {areaRow}
          <View style={{ flex: 1, paddingTop: 8 }}>{children}</View>
        </View>
      ) : (
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
          contentContainerStyle={{ width: "100%", maxWidth, alignSelf: "center", flexGrow: 1, paddingBottom: pad }}>
          {top}
          {areaRow}
          <View style={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: hero ? 16 : 8, gap: 14, minHeight: Math.max(360, height - 150) }}>
            {hero ? null : <ManageHeader title={title} line={line} actions={actions} />}
            {children}
          </View>
        </ScrollView>
      )}
      <ToastHost />
      {footer ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: g.card, borderTopWidth: 1, borderTopColor: g.line }}>
          <View style={{ width: "100%", maxWidth, alignSelf: "center" }}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------- Detail pieces ----------------
/** A titled group on a Detail / Form page (no heavy card: a soft panel). */
export function Block({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  const { g, row, align } = useGarageTheme();
  return (
    <View style={{ gap: 8 }}>
      {title || action ? (
        <View style={[row, { alignItems: "center", gap: 8 }]}>
          {title ? <GText accessibilityRole="header" style={[gType.label, align, { flex: 1, fontWeight: "800" }]}>{title}</GText> : <View style={{ flex: 1 }} />}
          {action}
        </View>
      ) : null}
      <View style={{ borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: g.card, paddingHorizontal: 14, paddingVertical: 4 }}>{children}</View>
    </View>
  );
}

/** Facts as label / value rows. Empty values are left out (no "—" walls). */
export function Facts({ rows }: { rows: ([string, ReactNode] | null | false | undefined)[] }) {
  const { g, row, align } = useGarageTheme();
  const shown = rows.filter((r): r is [string, ReactNode] => !!r && r[1] !== null && r[1] !== undefined && r[1] !== "");
  return (
    <View>
      {shown.map(([label, value], i) => (
        <View key={`${label}-${i}`} style={[row, { minHeight: 44, alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: g.line }]}>
          <GText soft style={[gType.caption, align, { width: "38%" }]}>{label}</GText>
          <View style={{ flex: 1, minWidth: 0 }}>{typeof value === "string" || typeof value === "number" ? <GText selectable style={[gType.bodySm, align]}>{String(value)}</GText> : value}</View>
        </View>
      ))}
    </View>
  );
}

// ---------------- Dashboard pieces ----------------
/** "Needs you now": a row with a count that opens the filtered list. Hidden by the caller when the count is 0. */
export function NeedsRow({ icon, title, count, sub, onPress }: { icon: GIconName; title: string; count: number; sub?: string; onPress: () => void }) {
  const { g, row, align, isArabic } = useGarageTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${count}${sub ? `. ${sub}` : ""}`} onPress={onPress}
      style={({ pressed }) => [row, { minHeight: 56, alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: pressed ? g.tint : g.card }]}>
      <GIcon name={icon} size={20} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText numberOfLines={1} style={[gType.label, align, { fontWeight: "700" }]}>{title}</GText>
        {sub ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{sub}</GText> : null}
      </View>
      <View style={{ minWidth: 30, height: 26, paddingHorizontal: 8, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: g.accent }}>
        <GText style={[gType.caption, { color: g.onAccent, fontWeight: "800" }]}>{String(count)}</GText>
      </View>
      <GIcon name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={g.soft} />
    </Pressable>
  );
}

/** Real numbers only: a tile shows "—" until its value is known. Two per row on phones, four on wide screens. */
export function Kpis({ items }: { items: { label: string; value: number | string | null | undefined; icon?: GIconName; onPress?: () => void }[] }) {
  const { g, row } = useGarageTheme();
  const { width } = useWindowDimensions();
  const basis = width >= 700 ? "23%" : "47%";
  return (
    <View style={[row, { flexWrap: "wrap", gap: 10 }]}>
      {items.map(k => (
        <Pressable key={k.label} disabled={!k.onPress} onPress={k.onPress} accessibilityRole={k.onPress ? "button" : undefined} accessibilityLabel={`${k.label}: ${k.value ?? "—"}`}
          style={({ pressed }) => ({ flexBasis: basis, flexGrow: 1, minHeight: 76, padding: 12, gap: 2, borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: pressed ? g.tint : g.card })}>
          {k.icon ? <GIcon name={k.icon} size={18} color={g.accentText} /> : null}
          <GText style={[gType.title, { fontWeight: "800" }]}>{k.value === null || k.value === undefined ? "—" : String(k.value)}</GText>
          <GText soft numberOfLines={2} style={gType.caption}>{k.label}</GText>
        </Pressable>
      ))}
    </View>
  );
}

/** A checklist line: ✓ / ✕, the item, and why it does not pass. */
export function CheckRow({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  const { g, row, align } = useGarageTheme();
  return (
    <View style={[row, { minHeight: 44, alignItems: "center", gap: 10, paddingVertical: 6 }]}>
      <GIcon name={ok ? "checkmark-circle" : "close-circle"} size={22} color={ok ? g.success : g.danger} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText style={[gType.bodySm, align, { fontWeight: "700" }]}>{label}</GText>
        {hint ? <GText soft style={[gType.caption, align]}>{hint}</GText> : null}
      </View>
    </View>
  );
}

/** Decisions and history, newest first: what happened, who, when, and the message / reason. */
export function History({ items }: { items: { title: string; at: string; who?: string; note?: string }[] }) {
  const { g, row, align } = useGarageTheme();
  return (
    <View>
      {items.map((e, i) => (
        <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: g.line }}>
          <View style={[row, { gap: 10 }]}>
            <GText style={[gType.bodySm, align, { flex: 1, fontWeight: "700" }]}>{e.title}</GText>
            <GText soft style={gType.tiny}>{e.at}</GText>
          </View>
          {e.who ? <GText soft style={[gType.caption, align]}>{e.who}</GText> : null}
          {e.note ? <GText soft style={[gType.caption, align]}>{e.note}</GText> : null}
        </View>
      ))}
    </View>
  );
}

// ---------------- states ----------------
/** The body of a Detail / Form page while its record loads: skeleton rows, then plain error + Retry, then the content. */
export function Loaded<T>({ state, children, rows = 5 }: { state: { data: T | null; error: string | null; reload: () => unknown }; children: (data: T) => ReactNode; rows?: number }) {
  const { t } = useL();
  if (state.data !== null && state.data !== undefined) return <>{children(state.data)}</>;
  if (state.error) return <ErrorState text={state.error} onRetry={() => void state.reload()} retryLabel={t("Retry", "إعادة المحاولة")} />;
  return <SkeletonRows count={rows} />;
}

/** Log out at the end of every profile hub; asks first. */
export function LogOut() {
  const { t } = useL();
  const { row } = useGarageTheme();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <GButton variant="danger" icon="log-out-outline" label={t("Log out", "تسجيل الخروج")} onPress={() => setConfirm(true)} />;
  return (
    <View style={{ gap: 10 }}>
      <Note tone="warning" icon="alert-circle-outline">{t("Log out of MOTEXA on this phone?", "تسجيل الخروج من موتكسا على هذا الهاتف؟")}</Note>
      <View style={[row, { gap: 10 }]}>
        <GButton flex variant="secondary" label={t("Stay", "البقاء")} onPress={() => setConfirm(false)} />
        <GButton flex variant="danger" label={t("Yes, log out", "نعم، سجّل الخروج")} onPress={() => void signOut()} />
      </View>
    </View>
  );
}

/** Private documents (owner + MOTEXA only): label, file name and expiry; tap opens it (image full screen, PDF in the system viewer). */
export function DocRows({ docs }: { docs: { label: string; fileName: string; expiresAt?: string | null; uri?: string | null; mimeType?: string }[] }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const viewer = useDocViewer();
  return (
    <View>
      {viewer.element}
      {docs.map((d, i) => {
        const expired = !!d.expiresAt && new Date(d.expiresAt).getTime() < Date.now();
        return (
          <Pressable key={`${d.label}-${i}`} disabled={!d.uri} accessibilityRole="button" accessibilityLabel={d.label}
            onPress={() => d.uri && viewer.open({ uri: d.uri, label: d.label, mimeType: d.mimeType ?? (/\.pdf$/i.test(d.fileName) ? "application/pdf" : "image/jpeg") })}
            style={({ pressed }) => [row, { minHeight: 52, alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: g.line, opacity: pressed ? 0.7 : 1 }]}>
            <GIcon name="document-lock-outline" size={22} color={g.accentText} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <GText style={[gType.bodySm, align, { fontWeight: "700" }]}>{d.label}</GText>
              <GText soft numberOfLines={1} style={[gType.caption, align]}>{[d.fileName, d.expiresAt ? `${t("expires", "ينتهي")} ${d.expiresAt.slice(0, 10)}` : null].filter(Boolean).join(" · ")}</GText>
            </View>
            {expired ? <StatusChip tone="danger" label={t("Expired", "منتهية")} /> : null}
            {d.uri ? <GIcon name="eye-outline" size={18} color={g.soft} /> : null}
          </Pressable>
        );
      })}
      <GText soft style={[gType.tiny, align, { paddingVertical: 8 }]}>{t("Private: visible only to MOTEXA admins and the owner.", "خاصة: تظهر فقط لمسؤولي MOTEXA والمالك.")}</GText>
    </View>
  );
}
