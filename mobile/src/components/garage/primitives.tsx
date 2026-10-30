// Garage building blocks: Tap, Card, Section, ListRow, Chip, StatusChip, Badge, GButton, IconButton, SearchBar, Toggle.
import { ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleProp, Switch, TextInput, View, ViewStyle } from "react-native";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { GIcon, GIconName, GText } from "./text";

/** Pressable with a soft press state. Never put a Tap inside another Tap (web renders nested buttons). */
export function Tap({ onPress, label, style, children, disabled, role = "button" }: { onPress?: () => void; label: string; style?: StyleProp<ViewStyle>; children: ReactNode; disabled?: boolean; role?: "button" | "link" | "tab" }) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: 0.86, transform: [{ scale: 0.985 }] }]}
    >
      {children}
    </Pressable>
  );
}

export function Card({ children, style, soft, onPress, label, pad = 16 }: { children: ReactNode; style?: StyleProp<ViewStyle>; soft?: boolean; onPress?: () => void; label?: string; pad?: number }) {
  const { g, shadow } = useGarageTheme();
  const box: StyleProp<ViewStyle> = [{ backgroundColor: soft ? g.cardSoft : g.card, borderRadius: gShape.card, padding: pad }, shadow(1), style];
  return onPress ? (
    <Tap label={label ?? ""} onPress={onPress} style={box}>
      {children}
    </Tap>
  ) : (
    <View style={box}>{children}</View>
  );
}

/** Section title + optional "See all". */
export function Section({ title, action, children, style }: { title: string; action?: { label: string; onPress: () => void }; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { g, row, align } = useGarageTheme();
  return (
    <View style={[{ marginTop: 28 }, style]}>
      <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }]}>
        <GText accessibilityRole="header" style={[gType.title, align, { flexShrink: 1 }]}>{title}</GText>
        {action ? (
          <Tap label={action.label} onPress={action.onPress} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }} role="link">
            <GText style={[gType.label, { color: g.accentText }]}>{action.label}</GText>
          </Tap>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** One settings / info row: icon bubble, title, sub, end slot (defaults to a chevron when pressable). */
export function ListRow({ icon, title, sub, end, onPress, danger, divider }: { icon?: GIconName; title: string; sub?: string; end?: ReactNode; onPress?: () => void; danger?: boolean; divider?: boolean }) {
  const { g, row, align } = useGarageTheme();
  const body = (
    <View style={[row, { minHeight: 56, alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: divider ? 1 : 0, borderTopColor: g.line }]}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: gShape.small, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
          <GIcon name={icon} size={20} color={danger ? g.danger : g.accentText} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText numberOfLines={2} style={[gType.label, align, danger && { color: g.danger }]}>{title}</GText>
        {sub ? <GText soft numberOfLines={2} style={[gType.caption, align, { marginTop: 1 }]}>{sub}</GText> : null}
      </View>
      {end ?? (onPress ? <GIcon name="chevron-forward" size={18} color={g.soft} flip /> : null)}
    </View>
  );
  return onPress ? (
    <Tap label={title} onPress={onPress}>
      {body}
    </Tap>
  ) : (
    body
  );
}

/** Rounded chip: a filter, a choice or a tappable label. */
export function Chip({ label, on, icon, onPress, count }: { label: string; on?: boolean; icon?: GIconName; onPress?: () => void; count?: number }) {
  const { g, row } = useGarageTheme();
  const fg = on ? g.onAccent : g.ink;
  return (
    <Tap
      label={label}
      onPress={onPress}
      style={[row, { minHeight: 40, alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: gShape.pill, borderWidth: 1, borderColor: on ? g.accent : g.line, backgroundColor: on ? g.accent : g.card }]}
    >
      {icon ? <GIcon name={icon} size={16} color={on ? g.onAccent : g.accentText} /> : null}
      <GText numberOfLines={1} style={[gType.caption, { fontWeight: "600", color: fg }]}>{label}</GText>
      {count !== undefined ? <GText style={[gType.tiny, { fontWeight: "700", color: on ? g.onAccent : g.soft }]}>{count}</GText> : null}
    </Tap>
  );
}

export type Tone = "neutral" | "accent" | "warning" | "success" | "danger";

const toneColor = (g: ReturnType<typeof useGarageTheme>["g"], tone: Tone) => ({ neutral: g.soft, accent: g.accentText, warning: g.warning, success: g.success, danger: g.danger })[tone];

/** Status pill: Draft neutral, Submitted accent, Needs changes warning, Approved success, Rejected danger. */
export function StatusChip({ label, tone = "neutral", icon }: { label: string; tone?: Tone; icon?: GIconName }) {
  const { g, row } = useGarageTheme();
  const c = toneColor(g, tone);
  return (
    <View style={[row, { alignSelf: "flex-start", alignItems: "center", gap: 5, minHeight: 26, paddingHorizontal: 10, borderRadius: gShape.pill, borderWidth: 1, borderColor: c, backgroundColor: g.card }]}>
      {icon ? <GIcon name={icon} size={13} color={c} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />}
      <GText numberOfLines={1} style={[gType.tiny, { fontWeight: "700", color: c }]}>{label}</GText>
    </View>
  );
}

/** Map of the app's review statuses to the garage chip. */
export const reviewTone = (s: string): Tone =>
  ({ DRAFT: "neutral", SUBMITTED: "accent", PENDING: "accent", NEEDS_CHANGES: "warning", APPROVED: "success", REJECTED: "danger" } as Record<string, Tone>)[s] ?? "neutral";

/** Product badge: −20%, Sold out, Only N left, New, Used. */
export function Badge({ label, tone = "accent" }: { label: string; tone?: Tone | "dark" }) {
  const { g, dark } = useGarageTheme();
  const bg = tone === "dark" ? g.ink : tone === "neutral" ? g.cardSoft : toneColor(g, tone);
  const fg = tone === "dark" ? g.page : tone === "neutral" ? g.ink : dark ? "#1F150F" : "#FFFFFF";
  return (
    <View style={{ alignSelf: "flex-start", minHeight: 22, justifyContent: "center", paddingHorizontal: 8, borderRadius: gShape.pill, backgroundColor: bg }}>
      <GText numberOfLines={1} style={[gType.tiny, { fontWeight: "800", color: fg }]}>{label}</GText>
    </View>
  );
}

export function GButton({ label, onPress, icon, variant = "primary", disabled, busy, style, flex }: { label: string; onPress: () => void; icon?: GIconName; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>; flex?: boolean }) {
  const { g, row } = useGarageTheme();
  const filled = variant === "primary";
  const fg = filled ? g.onAccent : variant === "danger" ? g.danger : variant === "secondary" ? g.ink : g.accentText;
  return (
    <Tap
      label={label}
      onPress={onPress}
      disabled={disabled || busy}
      style={[
        row,
        {
          minHeight: 50,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingHorizontal: 18,
          borderRadius: gShape.pill,
          backgroundColor: filled ? g.accent : variant === "secondary" ? g.card : "transparent",
          borderWidth: filled ? 0 : 1,
          borderColor: variant === "danger" ? g.danger : g.line,
          opacity: disabled ? 0.45 : 1,
        },
        flex && { flex: 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <GIcon name={icon} size={18} color={fg} /> : null}
      <GText numberOfLines={1} style={[gType.label, { fontWeight: "700", color: fg, flexShrink: 1 }]}>{label}</GText>
    </Tap>
  );
}

/** Round 44 px icon button (bell, map, back). `badge` shows a small count. */
export function IconButton({ icon, label, onPress, badge, flip, tone = "card" }: { icon: GIconName; label: string; onPress: () => void; badge?: number; flip?: boolean; tone?: "card" | "accent" }) {
  const { g, shadow } = useGarageTheme();
  return (
    <Tap label={label} onPress={onPress} style={[{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: tone === "accent" ? g.accent : g.card }, tone === "card" && shadow(1)]}>
      <GIcon name={icon} size={20} color={tone === "accent" ? g.onAccent : g.ink} flip={flip} />
      {badge ? (
        <View style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: g.danger, alignItems: "center", justifyContent: "center" }}>
          <GText style={{ fontSize: 10, lineHeight: 13, fontWeight: "800", color: "#FFFFFF" }}>{badge > 9 ? "9+" : badge}</GText>
        </View>
      ) : null}
    </Tap>
  );
}

export function SearchBar({ value, onChangeText, placeholder, onSubmit, trailing }: { value: string; onChangeText: (v: string) => void; placeholder: string; onSubmit?: () => void; trailing?: ReactNode }) {
  const { g, row, align, shadow } = useGarageTheme();
  return (
    <View style={[row, { minHeight: 52, alignItems: "center", gap: 10, paddingHorizontal: 16, borderRadius: gShape.pill, backgroundColor: g.card }, shadow(1)]}>
      <GIcon name="search-outline" size={20} color={g.soft} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={g.soft}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        accessibilityLabel={placeholder}
        style={[align, { flex: 1, minHeight: 48, color: g.ink, fontSize: 15 }]}
      />
      {value ? (
        <Tap label="Clear" onPress={() => onChangeText("")} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
          <GIcon name="close-circle" size={18} color={g.soft} />
        </Tap>
      ) : null}
      {trailing}
    </View>
  );
}

/** Labelled switch row (e.g. "Fits my car"). */
export function Toggle({ label, value, onChange, sub }: { label: string; value: boolean; onChange: (v: boolean) => void; sub?: string }) {
  const { g, dark, row, align } = useGarageTheme();
  return (
    <View style={[row, { alignItems: "center", gap: 12, minHeight: 44 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText style={[gType.label, align]}>{label}</GText>
        {sub ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{sub}</GText> : null}
      </View>
      {/* activeThumbColor: react-native-web only (otherwise its default teal shows) */}
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: g.accent, false: dark ? g.line : "#C9B39C" }} thumbColor="#FFFFFF" {...({ activeThumbColor: "#FFFFFF" } as object)} />
    </View>
  );
}

/** Horizontal rail, full-bleed to the page edges. Arabic starts at the right end and stays there while items load, until the user drags. */
export function Rail({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  const { row, isArabic } = useGarageTheme();
  const ref = useRef<ScrollView>(null);
  const dragged = useRef(false);
  const stick = () => {
    if (!isArabic || dragged.current) return;
    ref.current?.scrollToEnd({ animated: false });
    requestAnimationFrame(() => !dragged.current && ref.current?.scrollToEnd({ animated: false }));
  };
  // a language switch on an already-mounted screen changes neither layout nor content size: re-pin to the start edge
  useEffect(() => {
    dragged.current = false;
    if (isArabic) stick();
    else ref.current?.scrollTo({ x: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArabic]);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={[row, { gap, paddingHorizontal: 20, paddingVertical: 6, minWidth: "100%" }]}
      onScrollBeginDrag={() => {
        dragged.current = true;
      }}
      // web reports the content size before the viewport width is final: pin again after layout and on the next frame
      onLayout={stick}
      onContentSizeChange={stick}
    >
      {children}
    </ScrollView>
  );
}

/** Labelled text field (forms, price range). */
export function Field({ label, value, onChangeText, placeholder, error, multiline, keyboardType, maxLength, autoCapitalize }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; error?: string; multiline?: boolean; keyboardType?: "default" | "decimal-pad" | "number-pad" | "phone-pad"; maxLength?: number; autoCapitalize?: "none" | "characters" | "sentences" }) {
  const { g, align } = useGarageTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <GText style={[gType.caption, align, { fontWeight: "700", marginBottom: 6 }]}>{label}</GText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={g.soft}
        accessibilityLabel={label}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        style={[align, { minHeight: multiline ? 110 : 50, paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0, borderRadius: gShape.small, borderWidth: 1, borderColor: error ? g.danger : g.line, backgroundColor: g.card, color: g.ink, fontSize: 15, textAlignVertical: multiline ? "top" : "center" }]}
      />
      {error ? <GText style={[gType.caption, align, { color: g.danger, marginTop: 4 }]}>{error}</GText> : null}
    </View>
  );
}

/** A line of explanatory text in a tinted box (info / warning / danger). */
export function Note({ children, tone = "accent", icon = "information-circle-outline" }: { children: ReactNode; tone?: Tone; icon?: GIconName }) {
  const { g, row, align } = useGarageTheme();
  const c = toneColor(g, tone);
  return (
    <View style={[row, { gap: 10, alignItems: "flex-start", padding: 12, borderRadius: gShape.small, backgroundColor: g.tint, borderWidth: 1, borderColor: g.line, marginBottom: 12 }]}>
      <GIcon name={icon} size={18} color={c} />
      <GText style={[gType.bodySm, align, { flex: 1, color: tone === "danger" ? g.danger : g.ink }]}>{children}</GText>
    </View>
  );
}
