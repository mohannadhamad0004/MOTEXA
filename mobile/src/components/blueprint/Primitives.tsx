import { IBMPlexMono_400Regular, IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts } from "expo-font";
import { ReactNode, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Pressable,
  StyleProp,
  Text as NativeText,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Line } from "react-native-svg";
import { Text } from "../ui/Text";
import { useTheme } from "../../theme/useTheme";
import { Icon, IconName } from "./Icon";
import { Press, PulseRing, Rise } from "./motion";
import { useLanguage } from "../../i18n/LanguageContext";
import { useL } from "../../core/hooks/useL";

const ARABIC = /[؀-ۿ]/;
// Unicode left-to-right isolate: keeps prices, ids, plates and distances LTR inside Arabic text.
const isolate = (children: ReactNode) => (typeof children === "string" || typeof children === "number" ? `⁦${children}⁩` : children);

/** Small technical label: 11px uppercase, 0.2em tracking. Arabic: 12px, bold, no uppercase and no tracking. */
export function Tag({
  children,
  color,
  align,
  style,
}: {
  children: string;
  color?: string;
  align?: "left" | "right" | "center";
  style?: StyleProp<TextStyle>;
}) {
  const { c, isArabic } = useTheme();
  const ar = isArabic || ARABIC.test(children);
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={[
        {
          color: color ?? c.soft,
          fontSize: ar ? 12 : 11,
          fontWeight: ar ? "700" : "600",
          letterSpacing: ar ? 0 : 2.2,
          textAlign: align,
        },
        style,
      ]}
    >
      {ar ? children : children.toUpperCase()}
    </Text>
  );
}

/** IBM Plex Mono, always left-to-right (ids, part numbers, plates, times). */
export function Mono({
  children,
  color,
  size = 12,
  bold,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { c } = useTheme();
  const [ok] = useFonts({ PlexMono: IBMPlexMono_400Regular, PlexMonoSemi: IBMPlexMono_600SemiBold });
  return (
    <NativeText
      numberOfLines={numberOfLines}
      style={[
        { color: color ?? c.soft, fontSize: size, writingDirection: "ltr" },
        ok && { fontFamily: bold ? "PlexMonoSemi" : "PlexMono" },
        !ok && bold && { fontWeight: "700" },
        style,
      ]}
    >
      {isolate(children)}
    </NativeText>
  );
}

/** Left-to-right text inside an Arabic layout: prices (₪), distances, ids. */
export function Ltr({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const { c } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: c.ink, writingDirection: "ltr" }, style]}>
      {isolate(children)}
    </Text>
  );
}

export function Pill({ icon, children, tone }: { icon?: ReactNode; children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const { c, row } = useTheme();
  const fg = tone === "success" ? c.success : tone === "warning" ? c.warning : tone === "danger" ? c.danger : c.ink;
  const bg = tone === "success" ? c.successSoft : tone === "warning" ? c.warningSoft : tone === "danger" ? c.dangerSoft : c.pill;
  return (
    <View style={[row, { alignSelf: "flex-start", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: bg, paddingHorizontal: 12, paddingVertical: 6 }]}>
      {icon}
      <Text style={{ color: fg, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

export function H1({ children, size = 36 }: { children: ReactNode; size?: number }) {
  const { c, isArabic, align } = useTheme();
  return (
    <Text
      style={[
        { color: c.ink, fontSize: size, fontWeight: "700", marginTop: 16, lineHeight: Math.round(size * (isArabic ? 1.3 : 1.06)), letterSpacing: isArabic ? 0 : -0.025 * size },
        align,
      ]}
    >
      {children}
    </Text>
  );
}

export function Sub({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { c, align } = useTheme();
  return <Text style={[{ color: c.soft, fontSize: 15, lineHeight: 24, marginTop: 12 }, align, style]}>{children}</Text>;
}

/** "01 —  Title": mono number in bronze + 18px bold title, 40px above, rises in. */
export function Section({ n, title, children, right }: { n?: string; title: string; children?: ReactNode; right?: ReactNode }) {
  const { c, row, align } = useTheme();
  return (
    <Rise style={{ marginTop: 40 }}>
      <View style={[row, { alignItems: "baseline", gap: 12, marginBottom: 16 }]}>
        {n ? <Mono color={c.bronze}>{`${n} —`}</Mono> : null}
        <Text style={[{ color: c.ink, fontSize: 18, fontWeight: "700", flex: 1 }, align]}>{title}</Text>
        {right}
      </View>
      {children}
    </Rise>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  style,
  ...rest
}: { value: string; onChangeText: (v: string) => void; placeholder: string; onSubmit?: () => void; style?: StyleProp<ViewStyle> } & Omit<
  TextInputProps,
  "value" | "onChangeText" | "placeholder" | "style"
>) {
  const { c, row, isArabic } = useTheme();
  return (
    <View
      style={[
        row,
        { height: 56, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, alignItems: "center", paddingHorizontal: 16, gap: 12 },
        style,
      ]}
    >
      <Icon name="search" size={20} color={c.soft} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.soft}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        {...rest}
        style={{ flex: 1, height: "100%", color: c.ink, fontSize: 15, textAlign: isArabic ? "right" : "left" }}
      />
      {value.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10} onPress={() => onChangeText("")}>
          <Icon name="close" size={18} color={c.soft} />
        </Pressable>
      )}
    </View>
  );
}

/** 44px pill. on = filled (btn / btnFg), off = field + line border. */
export function Chip({
  label,
  on = false,
  onPress,
  icon,
  trailing,
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
  icon?: IconName;
  trailing?: IconName;
}) {
  const { c, row } = useTheme();
  const fg = on ? c.btnFg : c.ink;
  return (
    <Press
      onPress={onPress}
      accessibilityState={{ selected: on }}
      style={[
        row,
        {
          height: 44,
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 16,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: on ? c.btn : c.line,
          backgroundColor: on ? c.btn : c.field,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text numberOfLines={1} style={{ color: fg, fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
      {trailing ? <Icon name={trailing} size={16} color={fg} /> : null}
    </Press>
  );
}

/** h56 pill. primary = btn, outline = line border, danger = outline in the danger colour. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  loading,
  disabled,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger";
  style?: StyleProp<ViewStyle>;
}) {
  const { c, row } = useTheme();
  const filled = variant === "primary";
  const fg = filled ? c.btnFg : variant === "danger" ? c.danger : c.ink;
  const off = disabled || loading;
  return (
    <Press
      onPress={off ? undefined : onPress}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[
        row,
        {
          height: 56,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingHorizontal: 22,
          backgroundColor: filled ? c.btn : "transparent",
          borderWidth: filled ? 0 : 1,
          borderColor: variant === "danger" ? c.dangerBorder : c.line,
          opacity: disabled && !loading ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text numberOfLines={2} style={{ color: fg, fontSize: 15, fontWeight: "700", flexShrink: 1, textAlign: "center" }}>
        {label}
      </Text>
    </Press>
  );
}

/** Verified stamp: dashed bronze ring, inner ring, check and a tiny label. */
export function Stamp({ label }: { label: string }) {
  const { c, isArabic } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderStyle: "dashed", borderColor: c.bronze, alignItems: "center", justifyContent: "center" }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.bronze, alignItems: "center", justifyContent: "center" }}>
        <Icon name="check" size={14} color={c.bronze} />
        <Text
          numberOfLines={1}
          style={{ color: c.bronze, fontSize: 8, fontWeight: "700", marginTop: -1, letterSpacing: isArabic ? 0 : 0.6, maxWidth: 40, textAlign: "center" }}
        >
          {isArabic ? label : label.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/** Label / value line with a divider underneath. */
export function Row({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  const { c, row, isArabic } = useTheme();
  const empty = value === undefined || value === null || value === "";
  return (
    <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line + "99" }]}>
      <Text style={{ color: c.soft, fontSize: 14 }}>{label}</Text>
      <View style={{ flex: 1, alignItems: isArabic ? "flex-start" : "flex-end" }}>
        {typeof value === "string" || typeof value === "number" || empty ? (
          mono ? (
            <Mono color={c.ink} size={13} bold>{empty ? "—" : String(value)}</Mono>
          ) : (
            <Text style={{ color: c.ink, fontSize: 14, fontWeight: "600", textAlign: isArabic ? "left" : "right" }}>{empty ? "—" : value}</Text>
          )
        ) : (
          value
        )}
      </View>
    </View>
  );
}

/** Dashed horizontal line. */
export function Dash({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 2 }, style]}>
      <Svg width="100%" height="2">
        <Line x1="0" y1="1" x2="100%" y2="1" stroke={color} strokeWidth={1} strokeDasharray="3 3" />
      </Svg>
    </View>
  );
}

/** Horizontal progress: done = filled bronze + check, current = ring + dot, future = line colour, dashed connector. */
export function Steps({ labels, index }: { labels: string[]; index: number }) {
  const { c, row, isArabic } = useTheme();
  return (
    <View style={[row, { marginTop: 16, alignItems: "flex-start" }]}>
      {labels.map((l, k) => {
        const done = k < index;
        const now = k === index;
        const reached = k <= index;
        const conn = isArabic ? { right: "-50%" as const } : { left: "-50%" as const };
        return (
          <View key={k} style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <View style={{ width: "100%", height: 24, alignItems: "center", justifyContent: "center" }}>
              {k > 0 &&
                (reached ? (
                  <View style={[{ position: "absolute", width: "100%", height: 1, top: 11.5, backgroundColor: c.bronze }, conn]} />
                ) : (
                  <Dash color={c.line} style={[{ position: "absolute", width: "100%", top: 11 }, conn]} />
                ))}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderColor: reached ? c.bronze : c.line,
                  backgroundColor: done ? c.bronze : c.sheet,
                }}
              >
                {done ? <Icon name="check" size={14} color={c.sheet} /> : now ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.bronze }} /> : null}
              </View>
            </View>
            <Text numberOfLines={2} style={{ fontSize: 11, textAlign: "center", color: reached ? c.ink : c.soft, fontWeight: reached ? "700" : "400" }}>
              {l}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type TimelineItem = { key: string; label: string; at?: string; state: "done" | "now" | "next" };

/** Status screen timeline: circle rail with connectors, real timestamps in mono. */
export function VerticalTimeline({ items }: { items: TimelineItem[] }) {
  const { c, row, align } = useTheme();
  return (
    <View>
      {items.map((s, i) => (
        <View key={s.key} style={[row, { gap: 16 }]}>
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
                borderColor: s.state === "next" ? c.line : c.bronze,
                backgroundColor: s.state === "done" ? c.bronze : c.sheet,
              }}
            >
              {s.state === "done" ? (
                <Icon name="check" size={16} color={c.sheet} />
              ) : s.state === "now" ? (
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.bronze }} />
              ) : (
                <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: c.line }} />
              )}
            </View>
            {i < items.length - 1 &&
              (s.state === "done" ? (
                <View style={{ width: 1, height: 36, backgroundColor: c.bronze }} />
              ) : (
                <View style={{ width: 1, height: 36, borderLeftWidth: 1, borderStyle: "dashed", borderColor: c.line }} />
              ))}
          </View>
          <View style={[row, { flex: 1, justifyContent: "space-between", paddingTop: 4, gap: 10 }]}>
            <Text style={[{ flex: 1, fontSize: 15, color: s.state === "next" ? c.soft : c.ink, fontWeight: s.state === "next" ? "400" : "700" }, align]}>{s.label}</Text>
            {s.at && s.state !== "next" ? <Mono>{s.at}</Mono> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** "Updates automatically" line with the live pulse dot. */
export function LiveNote({ label }: { label: string }) {
  const { c, row, align } = useTheme();
  return (
    <View style={[row, { alignItems: "center", gap: 10, marginTop: 16 }]}>
      <PulseRing size={6} color={c.bronze} />
      <Text style={[{ color: c.soft, fontSize: 12 }, align]}>{label}</Text>
    </View>
  );
}

/** Corner-stamp card: bordered field surface. */
export function Panel({ children, onPress, style, bronze }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; bronze?: boolean }) {
  const { c, r } = useTheme();
  const base: ViewStyle = { borderRadius: r.lg, borderWidth: 1, borderColor: bronze ? c.bronze : c.line, backgroundColor: c.field, padding: 16 };
  return onPress ? (
    <Press onPress={onPress} style={[base, style]}>
      {children}
    </Press>
  ) : (
    <View style={[base, style]}>{children}</View>
  );
}

/** Segmented switch (EN | AR, Light | Dark | System). */
export function Seg<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const { c, row } = useTheme();
  return (
    <View style={[row, { borderRadius: 999, backgroundColor: c.pill, padding: 4 }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={{ minHeight: 36, minWidth: 44, borderRadius: 999, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.btn : "transparent" }}
          >
            <Text numberOfLines={1} style={{ color: on ? c.btnFg : c.soft, fontSize: 12, fontWeight: "700" }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Language + appearance controls, using the app's existing language / appearance state. */
export function SettingsControls() {
  const { c, row, mode, setMode } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { t } = useL();
  const line = (icon: IconName, label: string, control: ReactNode) => (
    <View style={[row, { minHeight: 56, alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line + "80" }]}>
      <Icon name={icon} size={20} color={c.bronze} />
      <Text style={{ flex: 1, color: c.ink, fontSize: 14, fontWeight: "600" }}>{label}</Text>
      {control}
    </View>
  );
  return (
    <View>
      {line("globe", t("Language", "اللغة"), <Seg value={language} onChange={setLanguage} options={[{ key: "en", label: "EN" }, { key: "ar", label: "AR" }]} />)}
      {line(
        "sun",
        t("Appearance", "المظهر"),
        <Seg value={mode} onChange={setMode} options={[{ key: "light", label: t("Light", "فاتح") }, { key: "dark", label: t("Dark", "داكن") }, { key: "system", label: t("System", "النظام") }]} />
      )}
    </View>
  );
}

/** Page title (34 bold) used by list screens; H1 is the 36px headline for intros. */
export function PageTitle({ children, size = 34 }: { children: ReactNode; size?: number }) {
  const { c, isArabic, align } = useTheme();
  return <Text style={[{ color: c.ink, fontSize: size, fontWeight: "700", lineHeight: Math.round(size * (isArabic ? 1.3 : 1.06)) }, align]}>{children}</Text>;
}

/** Category tabs with an underline on the active one. */
export function UnderlineTabs<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const { c } = useTheme();
  return (
    <HScroll gap={20} style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={{ height: 44, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: on ? c.ink : "transparent", marginBottom: -1 }}
          >
            <Text style={{ color: on ? c.ink : c.soft, fontSize: 14, fontWeight: on ? "700" : "400" }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </HScroll>
  );
}

/**
 * Horizontal scroller that runs to the sheet edges. In Arabic the items are laid out right-to-left and the strip
 * starts scrolled to its right end, so the first item is the one you see.
 */
export function HScroll({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const { row, isArabic } = useTheme();
  const ref = useRef<ScrollView>(null);
  const placed = useRef(false);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ marginHorizontal: -20 }, style]}
      contentContainerStyle={[row, { paddingHorizontal: 20, gap, minWidth: "100%" }]}
      onContentSizeChange={() => {
        if (isArabic && !placed.current) {
          placed.current = true;
          ref.current?.scrollToEnd({ animated: false });
        }
      }}
    >
      {children}
    </ScrollView>
  );
}

export const HStrip = HScroll;

/** Dense row of stat tiles with real counts (fleet, inventory, requests). Tone colours the number only. */
export function StatTiles({ items }: { items: { label: string; value: number | string; tone?: "success" | "warning" | "danger" }[] }) {
  const { c, row, align } = useTheme();
  return (
    <View style={[row, { gap: 8, marginBottom: 16 }]}>
      {items.map((it) => (
        <View key={it.label} style={{ flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Mono color={it.tone ? c[it.tone] : c.ink} size={20} bold>{String(it.value)}</Mono>
          <Text numberOfLines={2} style={[{ color: c.soft, fontSize: 11, marginTop: 2 }, align]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
