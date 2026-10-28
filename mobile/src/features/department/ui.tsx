// Department admin UI primitives. They are built FROM the super admin look (Diala's components and colours, imported, never copied):
// BrandWordmark, LanguageSwitch, EditorialTitle, CanvasFill, LoadingState, InteractiveButton, DashboardPhotography, the photo hero with its
// ivory curve, the stat tiles and the menu cards. Only the small compositions that her screens keep inline live here.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppearance } from "../../components/Appearance";
import BrandWordmark from "../../components/BrandWordmark";
import { CanvasFill } from "../../components/BrandSurfaces";
import { DashboardPhotography } from "../../components/DashboardPhotography";
import InteractiveButton from "../../components/InteractiveButton";
import LanguageSwitch from "../../components/LanguageSwitch";
import { LoadingState } from "../../components/LoadingState";
import { Text, VisualProvider, useReducedMotion } from "../../components/MotexaVisual";
import { EditorialTitle, SectionCaption } from "../../components/PremiumUI";
import { useLanguage } from "../../i18n/LanguageContext";
import { useDepartment } from "./DepartmentContext";

type IconName = keyof typeof Ionicons.glyphMap;

/** The super admin palette, in one place. */
export function useDT() {
  const { dark } = useAppearance();
  const { isArabic: ar } = useLanguage();
  return {
    dark,
    ar,
    t: (en: string, arabic: string) => (ar ? arabic : en),
    ink: dark ? "#FFF1DF" : "#432D1E",
    muted: dark ? "#DCC7A8" : "#6B4E34",
    surface: dark ? "#3F2F24" : "#FFFCF6",
    border: dark ? "#7A5B40" : "#DDC39E",
    /** solid bronze for primary actions and active states, and the ink that sits on it */
    fill: dark ? "#D9A066" : "#8E5A2B",
    fillInk: dark ? "#2A1A0E" : "#FFF8EE",
    soft: dark ? "#60432E" : "#F3D8B7",
    accent: dark ? "#F1C68F" : "#80522F",
    paper: dark ? "#30231B" : "#FFF9EF",
    warn: dark ? "#E8C07E" : "#9A6A1F",
    ok: dark ? "#9ED3A6" : "#2F7A45",
    bad: dark ? "#F1B8A0" : "#A24930",
    row: (ar ? "row-reverse" : "row") as "row" | "row-reverse",
    align: (ar ? "right" : "left") as "right" | "left",
    chip: (tone: Tone) => CHIP[dark ? "dark" : "light"][tone],
  };
}

export type Tone = "neutral" | "bronze" | "amber" | "ok" | "bad";
type ChipColors = { fg: string; bg: string; border: string };
const CHIP: Record<"dark" | "light", Record<Tone, ChipColors>> = {
  dark: {
    neutral: { fg: "#E3D3BC", bg: "#4A3A2E", border: "#6A5442" },
    bronze: { fg: "#F5C990", bg: "#5E4026", border: "#8E6438" },
    amber: { fg: "#F7D26E", bg: "#5A4513", border: "#8C6D1E" },
    ok: { fg: "#B2E3BA", bg: "#27452F", border: "#3E7049" },
    bad: { fg: "#FAB9AA", bg: "#5E2B23", border: "#92463A" },
  },
  light: {
    neutral: { fg: "#5A4533", bg: "#EFE3D2", border: "#D8C3A5" },
    bronze: { fg: "#7A4818", bg: "#F6DFC2", border: "#E0B98A" },
    amber: { fg: "#734E00", bg: "#FBE9B5", border: "#E6CB74" },
    ok: { fg: "#215A33", bg: "#D5EBD7", border: "#9CCBA3" },
    bad: { fg: "#8A2B1B", bg: "#F8D6CD", border: "#E3A99C" },
  },
};

/** Brand + department switcher + language/theme switch, as in the super admin top bar. */
function TopBar({ back }: { back?: boolean }) {
  const insets = useSafeAreaInsets();
  const d = useDT();
  return (
    <View style={[s.topbar, { paddingTop: insets.top + 7, backgroundColor: d.dark ? "#291F19" : "#FBF1E2" }]}>
      {back ? (
        <InteractiveButton accessibilityRole="button" accessibilityLabel={d.t("Back", "رجوع")} onPress={() => router.back()} style={s.back}>
          <Ionicons name={d.ar ? "arrow-forward" : "arrow-back"} size={22} color={d.ink} />
        </InteractiveButton>
      ) : null}
      <BrandWordmark size={20} style={{ flex: 1 }} />
      <LanguageSwitch compact light unified />
    </View>
  );
}

/** Department switcher: a full-width row under the top bar, only when the account holds two or more departments (or is a super admin). */
function Switcher() {
  const { available, active, setActive } = useDepartment();
  const d = useDT();
  if (available.length < 2) return null;
  return (
    <View style={{ flexDirection: d.row, gap: 8, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: d.dark ? "#291F19" : "#FBF1E2" }}>
      {available.map((dep) => {
        const on = dep.key === active.key;
        return (
          <InteractiveButton
            key={dep.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={d.t(dep.en, dep.ar)}
            onPress={() => setActive(dep.key)}
            style={{ flex: 1, minWidth: 0, minHeight: 40, borderRadius: 20, flexDirection: d.row, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: on ? "#E0A36F" : d.border, backgroundColor: on ? "#E0A36F" : "transparent" }}
          >
            <Ionicons name={dep.icon} size={16} color={on ? "#332218" : d.muted} />
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, fontWeight: "600", color: on ? "#332218" : d.ink }}>{d.t(dep.en, dep.ar)}</Text>
          </InteractiveButton>
        );
      })}
    </View>
  );
}

/** Photo hero with the ivory curve (the super admin Home hero). */
export function DeptHero({ image, greeting, title, subtitle }: { image: ImageSourcePropType; greeting: string; title: string; subtitle: string }) {
  const d = useDT();
  return (
    <View style={{ overflow: "hidden" }}>
      <ImageBackground source={image} resizeMode="cover" style={s.hero} imageStyle={{ opacity: d.dark ? 0.72 : 1 }}>
        <LinearGradient colors={["rgba(20,13,8,.58)", "rgba(20,13,8,.34)", "rgba(20,13,8,.4)"]} style={StyleSheet.absoluteFill} />
        <View style={s.welcome}>
          <Text style={[s.greeting, { textAlign: d.align }]}>{greeting}</Text>
          <EditorialTitle accent={false} style={[s.title, { color: "#FFF5E9", textAlign: d.align, maxWidth: "72%", alignSelf: d.ar ? "flex-end" : "flex-start" }]}>
            {title}
          </EditorialTitle>
          <Text style={[s.subtitle, { textAlign: d.align, maxWidth: "66%", alignSelf: d.ar ? "flex-end" : "flex-start" }]}>{subtitle}</Text>
        </View>
        <View
          pointerEvents="none"
          style={{ position: "absolute", bottom: -82, left: "-16%", width: "138%", height: 110, borderTopLeftRadius: 190, borderTopRightRadius: 280, backgroundColor: d.paper, transform: [{ rotate: d.ar ? "-3deg" : "3deg" }] }}
        />
      </ImageBackground>
    </View>
  );
}

/** Page frame: canvas, top bar, optional hero, body. Tabs add bottom padding for the floating tab bar. */
export function DeptPage({
  hero,
  back,
  children,
  refreshing,
  onRefresh,
  tabs = true,
  footer,
}: {
  hero?: ReactNode;
  back?: boolean;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  tabs?: boolean;
  /** sticky bar pinned to the bottom (for pages without the tab bar) */
  footer?: ReactNode;
}) {
  const d = useDT();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  return (
    <VisualProvider>
      <View style={{ flex: 1 }}>
        <CanvasFill />
        <StatusBar barStyle={d.dark ? "light-content" : "dark-content"} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
          contentContainerStyle={{ width: "100%", maxWidth: 680, alignSelf: "center", flexGrow: 1, paddingBottom: footer ? 170 : tabs ? 120 : 40 }}
        >
          <TopBar back={back} />
          <Switcher />
          {hero}
          <LinearGradient colors={d.dark ? ["#30231B", "#33271E", "#39281D"] : ["#FFF9EF", "#FBF0E0", "#F3DFC4"]} style={{ flexGrow: 1, paddingTop: hero ? 19 : 12, paddingHorizontal: 18, minHeight: Math.max(360, winH - 150) }}>
            {children}
          </LinearGradient>
        </ScrollView>
        {footer ? (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: d.dark ? "#241C16" : "#FBF1E2", borderTopWidth: 1, borderTopColor: d.border }}>
            <View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>{footer}</View>
          </View>
        ) : null}
      </View>
    </VisualProvider>
  );
}

export function Section({ title, caption }: { title: string; caption?: string }) {
  const d = useDT();
  return (
    <View style={{ marginBottom: 12, marginTop: 4 }}>
      <EditorialTitle accent={false} style={{ fontSize: 18, lineHeight: 27, fontWeight: "600", color: d.ink }}>{title}</EditorialTitle>
      {caption ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: d.align, marginTop: 2 }}>{caption}</Text> : null}
    </View>
  );
}

export { SectionCaption };

export function StatTile({ icon, value, label, tone }: { icon: IconName; value: string; label: string; tone?: "warn" }) {
  const d = useDT();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={[s.metric, { flex: 1, minWidth: 0, backgroundColor: d.surface, borderColor: tone === "warn" ? d.warn : d.border }]}>
      <View style={[s.metricIcon, { backgroundColor: d.soft }]}>
        <Ionicons name={icon} size={21} color={d.accent} />
      </View>
      <Text style={{ fontSize: 24, lineHeight: 32, marginTop: 3, color: d.ink }}>{value}</Text>
      <Text style={{ fontSize: 10, lineHeight: 16, textAlign: "center", color: d.muted }}>{label}</Text>
    </View>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  const d = useDT();
  const { width, fontScale } = useWindowDimensions();
  // narrow phones or large text: let the tiles wrap into two lines instead of truncating the labels
  const wrap = width < 340 || fontScale > 1.3;
  return <View style={{ flexDirection: d.row, flexWrap: wrap ? "wrap" : "nowrap", gap: 8, marginBottom: 22 }}>{children}</View>;
}

/** Menu card: title + description on the start side, a photograph on the end side. */
export function MenuCard({ title, description, icon, photo, badge, onPress }: { title: string; description: string; icon: IconName; photo: number; badge?: string; onPress: () => void }) {
  const d = useDT();
  return (
    <InteractiveButton accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={[s.menu, { flexDirection: d.row, backgroundColor: d.surface, borderColor: d.border }]}>
      <View style={{ flex: 1, minWidth: 0, padding: 12, gap: 6 }}>
        <View style={{ flexDirection: d.row, alignItems: "center", gap: 8 }}>
          <Ionicons name={icon} size={18} color={d.muted} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, lineHeight: 22, fontWeight: "600", color: d.ink, textAlign: d.align }}>{title}</Text>
          {badge ? <Pill tone="warn" label={badge} /> : null}
        </View>
        <Text numberOfLines={3} style={{ fontSize: 11, lineHeight: 18, color: d.muted, textAlign: d.align }}>{description}</Text>
      </View>
      <View style={{ width: "28%", alignSelf: "stretch", overflow: "hidden" }}>
        <DashboardPhotography index={photo} style={StyleSheet.absoluteFill} />
        <View style={[s.menuArrow, d.ar ? { left: 9 } : { right: 9 }]}>
          <Ionicons name={d.ar ? "arrow-back" : "arrow-forward"} size={16} color="#FFF1DF" />
        </View>
      </View>
    </InteractiveButton>
  );
}

/** The one chip of the admin area: tinted background, border and text in the same hue. */
export function Pill({ label, tone = "neutral", icon, size = "s" }: { label: string; tone?: Tone | "warn"; icon?: IconName; size?: "s" | "l" }) {
  const d = useDT();
  const c = d.chip(tone === "warn" ? "amber" : tone);
  const big = size === "l";
  return (
    <View style={{ flexDirection: d.row, alignItems: "center", gap: big ? 6 : 4, paddingHorizontal: big ? 14 : 9, paddingVertical: big ? 7 : 3, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, alignSelf: "flex-start" }}>
      {icon ? <Ionicons name={icon} size={big ? 16 : 12} color={c.fg} /> : null}
      <Text style={{ fontSize: big ? 14 : 11, lineHeight: big ? 21 : 17, color: c.fg, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

const STATUS: Record<string, { tone: Tone; icon: IconName; en: string; ar: string }> = {
  DRAFT: { tone: "neutral", icon: "document-outline", en: "Draft", ar: "مسودة" },
  PENDING: { tone: "bronze", icon: "paper-plane-outline", en: "Submitted", ar: "تم الإرسال" },
  NEEDS_CHANGES: { tone: "amber", icon: "create-outline", en: "Needs changes", ar: "مطلوب تعديلات" },
  APPROVED: { tone: "ok", icon: "shield-checkmark-outline", en: "Approved", ar: "معتمد" },
  REJECTED: { tone: "bad", icon: "close-circle-outline", en: "Rejected", ar: "مرفوض" },
};
const DOC_STATUS: Record<string, { tone: Tone; icon: IconName; en: string; ar: string }> = {
  PENDING: { tone: "amber", icon: "time-outline", en: "Waiting", ar: "بانتظار المراجعة" },
  ACCEPTED: { tone: "ok", icon: "checkmark-circle-outline", en: "Accepted", ar: "مقبول" },
  REJECTED: { tone: "bad", icon: "close-circle-outline", en: "Rejected", ar: "مرفوض" },
};

/** Application / company / shop / truck status (kind app) or document status (kind doc). Same colours on every screen. */
export function StatusChip({ status, kind = "app", size = "s" }: { status: string; kind?: "app" | "doc"; size?: "s" | "l" }) {
  const d = useDT();
  const m = (kind === "doc" ? DOC_STATUS : STATUS)[status] ?? STATUS.DRAFT;
  return <Pill size={size} tone={m.tone} icon={m.icon} label={d.t(m.en, m.ar)} />;
}
export const StatusPill = ({ value }: { value: string }) => <StatusChip status={value} />;

/** The one card look: radius 22, subtle border, soft shadow. */
export const cardStyle = (d: ReturnType<typeof useDT>, tone?: "warn" | "bad"): ViewStyle => ({
  borderWidth: 1,
  borderRadius: 22,
  backgroundColor: d.surface,
  borderColor: tone === "bad" ? d.bad : tone === "warn" ? d.warn : d.border,
  shadowColor: "#4F2D17",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: d.dark ? 0.35 : 0.1,
  shadowRadius: 10,
  elevation: 2,
});

/** A tappable list card (request / directory row). */
export function ItemCard({ children, onPress, label }: { children: ReactNode; onPress?: () => void; label: string }) {
  const d = useDT();
  const body = (
    <View style={{ flexDirection: d.row, alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {onPress ? <Ionicons name={d.ar ? "chevron-back" : "chevron-forward"} size={19} color={d.accent} /> : null}
    </View>
  );
  const box: ViewStyle = { ...cardStyle(d), padding: 14, marginBottom: 10 };
  return onPress ? (
    <InteractiveButton accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={box}>{body}</InteractiveButton>
  ) : (
    <View accessible accessibilityLabel={label} style={box}>{body}</View>
  );
}

/** Card with an optional title row (icon + title) so every card reads title, then meta, then action. */
export function Panel({ children, tone, title, icon }: { children: ReactNode; tone?: "warn" | "bad"; title?: string; icon?: IconName }) {
  const d = useDT();
  return (
    <View style={{ ...cardStyle(d, tone), padding: 16, marginBottom: 14, gap: 4 }}>
      {title ? (
        <View style={{ flexDirection: d.row, alignItems: "center", gap: 8, marginBottom: 6 }}>
          {icon ? <Ionicons name={icon} size={18} color={d.accent} /> : null}
          <Text style={{ flex: 1, color: d.ink, fontSize: 15, lineHeight: 23, fontWeight: "700", textAlign: d.align }}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Initial in a tinted circle: the avatar of a business or a person. */
export function Avatar({ name, size = 44, tone = "bronze" }: { name: string; size?: number; tone?: Tone }) {
  const d = useDT();
  const c = d.chip(tone);
  const initial = (name.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.fg, fontSize: size * 0.42, lineHeight: size * 0.6, fontWeight: "700" }}>{initial}</Text>
    </View>
  );
}

/** Round count badge in bronze. */
export function CountBadge({ n }: { n: number }) {
  const d = useDT();
  if (!n) return null;
  return (
    <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: d.fill, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: d.fillInk, fontSize: 12, lineHeight: 16, fontWeight: "800" }}>{n > 99 ? "99+" : n}</Text>
    </View>
  );
}

export function KV({ k, v }: { k: string; v?: string | number | null }) {
  const d = useDT();
  if (v === undefined || v === null || v === "") return null;
  return (
    <View style={{ flexDirection: d.row, justifyContent: "space-between", gap: 14, paddingVertical: 7 }}>
      <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19 }}>{k}</Text>
      <Text selectable style={{ flex: 1, color: d.ink, fontSize: 13, lineHeight: 20, textAlign: d.ar ? "left" : "right" }}>{String(v)}</Text>
    </View>
  );
}

export function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  const d = useDT();
  return (
    <View style={{ flexDirection: d.row, alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <Ionicons name={ok ? "checkmark-circle" : "close-circle"} size={22} color={ok ? d.ok : d.bad} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: d.ink, fontSize: 13, lineHeight: 20, fontWeight: "600", textAlign: d.align }}>{label}</Text>
        {hint ? <Text style={{ color: d.muted, fontSize: 11, lineHeight: 17, textAlign: d.align }}>{hint}</Text> : null}
      </View>
    </View>
  );
}

export function DButton({ label, icon, onPress, variant = "primary", disabled, compact }: { label: string; icon?: IconName; onPress: () => void; variant?: "primary" | "success" | "warn" | "ghost" | "danger"; disabled?: boolean; compact?: boolean }) {
  const d = useDT();
  const solid = { primary: [d.fill, d.fillInk], success: [d.dark ? "#4E9A60" : "#2F7A45", "#FFFFFF"], warn: [d.dark ? "#E8B24A" : "#B97A12", d.dark ? "#2B1D00" : "#FFFFFF"] } as Record<string, [string, string]>;
  const [bg, fg] = solid[variant] ?? ["transparent", variant === "danger" ? d.bad : d.accent];
  const border = variant === "danger" ? d.bad : variant === "ghost" ? d.border : bg;
  return (
    <InteractiveButton
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: compact ? 40 : 50, borderRadius: 26, borderWidth: 1.5, borderColor: border, backgroundColor: bg, flexDirection: d.row, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: compact ? 12 : 18, opacity: disabled ? 0.45 : 1 }}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: compact ? 13 : 14, lineHeight: 22, fontWeight: "700", flexShrink: 1, textAlign: "center" }}>{label}</Text>
    </InteractiveButton>
  );
}

/** Reason box shown before a reject / hide. The reason is required. */
export function ReasonBox({ title, confirmLabel, busy, onCancel, onConfirm }: { title: string; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const d = useDT();
  const ref = useRef("");
  const [empty, setEmpty] = useState(false);
  return (
    <View style={{ gap: 10, marginTop: 6 }}>
      <Text style={{ color: d.ink, fontSize: 13, lineHeight: 20, fontWeight: "600", textAlign: d.align }}>{title}</Text>
      <TextInput
        multiline
        maxLength={1000}
        onChangeText={(v) => {
          ref.current = v;
          if (empty && v.trim()) setEmpty(false);
        }}
        placeholderTextColor={d.muted}
        style={{ minHeight: 84, borderRadius: 16, borderWidth: 1, borderColor: empty ? d.bad : d.border, color: d.ink, padding: 12, textAlignVertical: "top", textAlign: d.align, backgroundColor: d.dark ? "#2C2119" : "#FFFDF8" }}
      />
      {empty ? <Text style={{ color: d.bad, fontSize: 12, textAlign: d.align }}>{d.t("A reason is required.", "السبب مطلوب.")}</Text> : null}
      <DButton label={confirmLabel} variant="danger" disabled={busy} onPress={() => (ref.current.trim() ? onConfirm(ref.current.trim()) : setEmpty(true))} />
      <DButton label={d.t("Cancel", "إلغاء")} variant="ghost" onPress={onCancel} />
    </View>
  );
}

export function Empty({ icon, text, hint }: { icon: IconName; text: string; hint?: string }) {
  const d = useDT();
  return (
    <View style={{ ...cardStyle(d), alignItems: "center", gap: 10, padding: 28, marginTop: 4 }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: d.soft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={28} color={d.accent} />
      </View>
      <Text style={{ color: d.ink, fontSize: 14, lineHeight: 22, fontWeight: "600", textAlign: "center" }}>{text}</Text>
      {hint ? <Text style={{ color: d.muted, fontSize: 12, lineHeight: 19, textAlign: "center" }}>{hint}</Text> : null}
    </View>
  );
}

/** Loading / error / content for one async state (shape of useLoad). */
export function Load<T>({ state, children }: { state: { data: T | null; error: string | null; loading: boolean; reload: () => unknown }; children: (data: T) => ReactNode }) {
  const d = useDT();
  if (state.data) return <>{children(state.data)}</>;
  if (state.loading) return <LoadingState rows={2} label={d.t("Loading…", "جارٍ التحميل…")} />;
  return (
    <Panel tone="bad">
      <Text style={{ color: d.ink, fontSize: 13, lineHeight: 21, textAlign: d.align }}>{state.error || d.t("Something went wrong.", "حدث خطأ ما.")}</Text>
      <View style={{ height: 8 }} />
      <DButton label={d.t("Try again", "حاول مرة أخرى")} variant="ghost" icon="refresh" onPress={() => void state.reload()} />
    </Panel>
  );
}

export function Busy() {
  return <ActivityIndicator style={{ marginVertical: 20 }} color="#C98B5B" />;
}

/** The floating oval tab bar of the super admin, rebuilt for the department tabs (hers lives inline in its layout). */
export function DeptTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const d = useDT();
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 6), backgroundColor: d.dark ? "#241D18" : "#F3DFC4" }}>
      <View style={{ flexDirection: d.row, alignItems: "center", padding: 5, gap: 3, borderRadius: 38, backgroundColor: d.dark ? "#35291F" : "#FFFAF1", elevation: 5, shadowColor: "#4F2D17", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 14 }}>
        {state.routes.map((route: any, index: number) => {
          const options = descriptors[route.key].options;
          const selected = state.index === index;
          const label = typeof options.title === "string" ? options.title : route.name;
          return (
            <Tab
              key={route.key}
              selected={selected}
              label={label}
              icon={options.tabBarIcon?.({ focused: selected, color: selected ? (d.dark ? "#352216" : "#462E1C") : d.muted, size: 22 })}
              badge={options.tabBarBadge}
              onPress={() => {
                const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!selected && !e.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function Tab({ selected, label, icon, badge, onPress }: { selected: boolean; label: string; icon: ReactNode; badge?: number | string; onPress: () => void }) {
  const d = useDT();
  const reduced = useReducedMotion();
  const flex = useRef(new Animated.Value(selected ? 2.5 : 1)).current;
  useEffect(() => {
    if (reduced) return flex.setValue(selected ? 2.5 : 1);
    const a = Animated.timing(flex, { toValue: selected ? 2.5 : 1, duration: 220, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [selected, reduced, flex]);
  return (
    <Animated.View style={{ flex, minWidth: 44 }}>
      <InteractiveButton
        accessibilityRole="tab"
        accessibilityLabel={badge ? `${label} (${badge})` : label}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={{ height: 52, borderRadius: 26, flexDirection: d.row, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: selected ? (d.dark ? "#E0B67F" : "#704A2B") : "transparent" }}
      >
        <View>
          {icon}
          {badge ? (
            <View style={{ position: "absolute", top: -6, [d.ar ? "left" : "right"]: -9, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: "#C0462F", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFF", fontSize: 10, lineHeight: 14, fontWeight: "700" }}>{String(badge)}</Text>
            </View>
          ) : null}
        </View>
        {selected ? <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: d.dark ? "#352216" : "#FFF9F0", flexShrink: 1 }}>{label}</Text> : null}
      </InteractiveButton>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  topbar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  back: { width: 34, height: 40, alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", overflow: "hidden", height: 232, paddingHorizontal: 20, justifyContent: "flex-end", paddingTop: 20, paddingBottom: 48, backgroundColor: "#503522" },
  welcome: { position: "absolute", top: 23, left: 20, right: 20 },
  greeting: { fontSize: 13, color: "#F2DDC4", marginBottom: 3 },
  title: { fontSize: 27, lineHeight: 36, fontWeight: "600" },
  subtitle: { fontSize: 12, lineHeight: 21, color: "#F2DDC4", marginTop: 5 },
  metric: { minHeight: 100, borderWidth: 1, borderRadius: 18, padding: 7, alignItems: "center", justifyContent: "center" },
  metricIcon: { width: 35, height: 35, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  menu: { height: 108, minHeight: 108, borderRadius: 19, overflow: "hidden", alignItems: "center", marginBottom: 12, borderWidth: 1 },
  menuArrow: { position: "absolute", bottom: 9, width: 28, height: 28, borderRadius: 14, backgroundColor: "#573C29D9", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E6C6A17A" },
});

/** Bottom sheet (reason boxes, request-changes form). Tap outside or the handle area to close. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const d = useDT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#000000AA" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={d.t("Close", "إغلاق")} style={{ flex: 1 }} onPress={onClose} />
        <View style={{ maxHeight: "88%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: d.dark ? "#2D221A" : "#FFFCF6", borderTopWidth: 1, borderColor: d.border, paddingBottom: Math.max(insets.bottom, 14) }}>
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: d.border }} />
          </View>
          <Text style={{ color: d.ink, fontSize: 17, lineHeight: 26, fontWeight: "800", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, textAlign: d.align }}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
