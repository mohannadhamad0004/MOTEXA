import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Href, router, useFocusEffect } from "expo-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../i18n/LanguageContext";
import { C } from "./palette";
import { SessionProvider, SessionUser, signOut, useSession } from "./session";

type IconName = keyof typeof Ionicons.glyphMap;

/** en/ar picker + RTL helpers, following the existing `isArabic ? ar : en` convention. */
export function useL() {
  const { isArabic, toggleLanguage } = useLanguage();
  return {
    isArabic,
    toggleLanguage,
    t: (en: string, ar: string) => (isArabic ? ar : en),
    row: { flexDirection: isArabic ? "row-reverse" : "row" } as const,
    align: { textAlign: isArabic ? "right" : "left" } as const,
  };
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fn()
      .then(setData)
      .catch((e) => setError(e?.message ?? "Error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  // Reload whenever the screen regains focus so lists reflect edits made on a pushed screen.
  useFocusEffect(reload);
  return { data, error, loading, reload };
}

/** Client-side UX gate. Backend must enforce the same rule once real endpoints exist. */
export function RoleGate({
  allow,
  children,
}: {
  allow: (u: SessionUser) => boolean;
  children: ReactNode;
}) {
  const s = useSession();
  const { t } = useL();
  useEffect(() => {
    if (s.status === "none") router.replace("/auth/login");
  }, [s.status]);

  if (s.status !== "ready")
    return (
      <Center>
        <ActivityIndicator size="large" color={C.accent} />
      </Center>
    );
  if (!allow(s.user)) {
    return (
      <Center>
        <Ionicons name="lock-closed-outline" size={34} color={C.accent} />
        <Text style={[st.title, { fontSize: 20, marginTop: 14 }]}>
          {t("Access denied", "الوصول مرفوض")}
        </Text>
        <Text style={[st.muted, { textAlign: "center", marginTop: 6 }]}>
          {t(
            "Your account is not allowed to open this area.",
            "حسابك غير مصرّح له بفتح هذه المنطقة."
          )}
        </Text>
        <View style={{ height: 18 }} />
        <Button label={t("Sign out", "تسجيل الخروج")} variant="ghost" onPress={signOut} />
      </Center>
    );
  }
  return <SessionProvider user={s.user}>{children}</SessionProvider>;
}

function Center({ children }: { children: ReactNode }) {
  return (
    <View style={[st.screen, { alignItems: "center", justifyContent: "center", padding: 28 }]}>
      {children}
    </View>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={st.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <LinearGradient colors={C.gradient} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 48,
          }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function Header({
  brand,
  title,
  subtitle,
  back,
  signOutButton,
}: {
  brand: string;
  title: string;
  subtitle?: string;
  back?: boolean;
  signOutButton?: boolean;
}) {
  const { isArabic, toggleLanguage, row, align, t } = useL();
  return (
    <View style={{ marginBottom: 20 }}>
      <View
        style={[row, { alignItems: "center", justifyContent: "space-between", marginBottom: 14 }]}
      >
        {back ? (
          <IconButton
            icon={isArabic ? "arrow-forward" : "arrow-back"}
            label={t("Back", "رجوع")}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          />
        ) : (
          <View style={[row, { alignItems: "center", gap: 7 }]}>
            <View style={{ width: 18, height: 2, borderRadius: 2, backgroundColor: C.brand }} />
            <Text style={{ color: C.brand, fontSize: 10, letterSpacing: 2, fontWeight: "800" }}>
              {brand}
            </Text>
          </View>
        )}
        <View style={[row, { gap: 8 }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Language"
            activeOpacity={0.8}
            onPress={toggleLanguage}
            style={st.langBtn}
          >
            <Ionicons name="language-outline" size={18} color="#E1A16F" />
            <Text style={{ color: "#E1A16F", fontSize: 11, fontWeight: "800" }}>
              {isArabic ? "EN" : "AR"}
            </Text>
          </TouchableOpacity>
          {signOutButton && (
            <IconButton
              icon="log-out-outline"
              label={t("Sign out", "تسجيل الخروج")}
              onPress={signOut}
            />
          )}
        </View>
      </View>
      <Text style={[st.title, align]}>{title}</Text>
      {subtitle ? (
        <Text style={[st.muted, align, { marginTop: 3, lineHeight: 20 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.8}
      onPress={onPress}
      style={st.iconBtn}
    >
      <Ionicons name={icon} size={21} color={C.accent} />
    </TouchableOpacity>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { row, isArabic, t } = useL();
  return (
    <View style={[st.search, row]}>
      <Ionicons name="search-outline" size={20} color={C.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#7E6D62"
        accessibilityLabel={placeholder}
        style={{
          flex: 1,
          height: "100%",
          color: C.text,
          marginHorizontal: 10,
          fontSize: 14,
          textAlign: isArabic ? "right" : "left",
        }}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChange("")}
          accessibilityLabel={t("Clear", "مسح")}
          style={{ padding: 8 }}
        >
          <Ionicons name="close-circle" size={19} color="#8F7E73" />
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Segmented control, same look as the Applications/Verified tabs in admin/mechanics. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const { row } = useL();
  return (
    <View style={[st.segWrap, row]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[st.seg, on && { backgroundColor: C.accent }]}
          >
            <Text
              numberOfLines={1}
              style={{ color: on ? C.onAccent : "#8F7D71", fontSize: 11, fontWeight: "800" }}
            >
              {o.label}
              {o.count !== undefined ? ` ${o.count}` : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Card({
  children,
  onPress,
  label,
}: {
  children: ReactNode;
  onPress?: () => void;
  label?: string;
}) {
  if (onPress)
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        activeOpacity={0.82}
        onPress={onPress}
        style={st.card}
      >
        {children}
      </TouchableOpacity>
    );
  return <View style={st.card}>{children}</View>;
}

export type Tone = "accent" | "success" | "danger" | "neutral";
const TONES: Record<Tone, { fg: string; bg: string; border: string }> = {
  accent: { fg: C.accent, bg: C.accentSoft, border: C.accentBorder },
  success: { fg: C.success, bg: C.successSoft, border: C.successBorder },
  danger: { fg: C.danger, bg: C.dangerSoft, border: C.dangerBorder },
  neutral: { fg: "#9A877A", bg: "rgba(255,245,234,0.04)", border: "rgba(255,245,234,0.10)" },
};

export function Badge({
  tone,
  label,
  icon,
  prefix,
}: {
  tone: Tone;
  label: string;
  icon?: IconName;
  prefix?: string;
}) {
  const k = TONES[tone];
  return (
    <View
      style={[st.badge, { backgroundColor: k.bg, borderColor: k.border }]}
      accessible
      accessibilityLabel={`${prefix ?? ""} ${label}`}
    >
      {icon ? <Ionicons name={icon} size={12} color={k.fg} style={{ marginHorizontal: 3 }} /> : null}
      {prefix ? (
        <Text style={{ color: C.textDim, fontSize: 10, fontWeight: "700", marginHorizontal: 3 }}>
          {prefix}
        </Text>
      ) : null}
      <Text style={{ color: k.fg, fontSize: 10, fontWeight: "800", marginHorizontal: 3 }}>
        {label}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  icon?: IconName;
}) {
  const { row } = useL();
  const v = {
    primary: { bg: C.accent, fg: C.onAccent, border: C.accent },
    ghost: { bg: C.accentSoft, fg: C.accent, border: C.accentBorder },
    danger: { bg: C.dangerSoft, fg: C.danger, border: C.dangerBorder },
  }[variant];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        st.btn,
        row,
        { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={v.fg} style={{ marginHorizontal: 6 }} /> : null}
      <Text style={{ color: v.fg, fontSize: 14, fontWeight: "800" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field({ label, error, ...p }: TextInputProps & { label: string; error?: string }) {
  const { align } = useL();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[st.label, align]}>{label}</Text>
      <TextInput
        placeholderTextColor="#7E6D62"
        accessibilityLabel={label}
        {...p}
        style={[
          st.input,
          align,
          p.multiline && { minHeight: 92, textAlignVertical: "top", paddingTop: 12 },
          error ? { borderColor: C.dangerBorder } : null,
        ]}
      />
      {error ? (
        <Text style={[{ color: C.danger, fontSize: 12, marginTop: 5 }, align]}>{error}</Text>
      ) : null}
    </View>
  );
}

export function Section({ title }: { title: string }) {
  const { align } = useL();
  return (
    <Text
      style={[
        {
          color: "#E8D8CC",
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 1.2,
          marginTop: 22,
          marginBottom: 12,
        },
        align,
      ]}
    >
      {title.toUpperCase()}
    </Text>
  );
}

export function KV({ k, v }: { k: string; v?: string | number | null }) {
  const { row, isArabic } = useL();
  return (
    <View style={[row, { justifyContent: "space-between", paddingVertical: 8, gap: 12 }]}>
      <Text style={{ color: C.textDim, fontSize: 12, fontWeight: "700" }}>{k}</Text>
      <Text
        style={{ color: C.text, fontSize: 13, flex: 1, textAlign: isArabic ? "left" : "right" }}
      >
        {v === undefined || v === null || v === "" ? "—" : String(v)}
      </Text>
    </View>
  );
}

export function Thumb({
  uri,
  icon,
  size = 56,
}: {
  uri?: string | null;
  icon: IconName;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        backgroundColor: C.accentSoft,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Ionicons name={icon} size={size * 0.45} color={C.accent} />
      )}
    </View>
  );
}

export function Notice({
  tone = "accent",
  icon = "information-circle-outline",
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}) {
  const k = TONES[tone];
  const { row, align } = useL();
  return (
    <View
      style={[
        row,
        {
          gap: 10,
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          backgroundColor: k.bg,
          borderColor: k.border,
          marginBottom: 12,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={k.fg} />
      <Text style={[{ color: k.fg, fontSize: 12, lineHeight: 18, flex: 1 }, align]}>
        {children}
      </Text>
    </View>
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 44 }}>
      <Ionicons name={icon} size={34} color={C.textDim} />
      <Text style={[st.muted, { marginTop: 10, textAlign: "center" }]}>{text}</Text>
    </View>
  );
}

/** Loading / error / content wrapper for useLoad(). */
export function Async<T>({
  state,
  children,
}: {
  state: { data: T | null; error: string | null; loading: boolean; reload: () => void };
  children: (d: T) => ReactNode;
}) {
  const { t } = useL();
  if (state.loading && !state.data)
    return <ActivityIndicator style={{ marginTop: 50 }} size="large" color={C.accent} />;
  if (state.error || !state.data)
    return (
      <View style={{ alignItems: "center", paddingVertical: 40, gap: 14 }}>
        <Text style={[st.muted, { textAlign: "center" }]}>
          {state.error ?? t("Could not load data.", "تعذّر تحميل البيانات.")}
        </Text>
        <Button
          label={t("Retry", "إعادة المحاولة")}
          variant="ghost"
          onPress={state.reload}
          icon="refresh-outline"
        />
      </View>
    );
  return <>{children(state.data)}</>;
}

/** Back, or a fallback route when the screen was opened directly (no history, e.g. deep link / web reload). */
export const goBack = (fallback: Href) => (router.canGoBack() ? router.back() : router.replace(fallback));

/** Picks an image from the library. Returns a local uri, or null if cancelled. */
export async function pickImage(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
  return r.canceled ? null : r.assets[0].uri;
}

/** Reject-reason panel: a reason is required. */
export function ReasonPanel({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  required = true,
}: {
  title: string;
  confirmLabel: string;
  required?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const { t } = useL();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const bad = required && reason.trim().length < 3;
  return (
    <View style={{ marginTop: 12 }}>
      <Field
        label={title}
        value={reason}
        onChangeText={setReason}
        multiline
        error={touched && bad ? t("A reason is required.", "السبب مطلوب.") : undefined}
      />
      <View style={{ gap: 8 }}>
        <Button
          label={confirmLabel}
          variant="danger"
          onPress={() => {
            setTouched(true);
            if (!bad) onConfirm(reason.trim());
          }}
        />
        <Button label={t("Cancel", "إلغاء")} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  title: { color: C.text, fontSize: 30, lineHeight: 37, fontWeight: "800", letterSpacing: -0.7 },
  muted: { color: C.textMuted, fontSize: 13 },
  label: { color: "#E8D8CC", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 7 },
  input: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.fieldBorder,
    backgroundColor: C.field,
    color: C.text,
    paddingHorizontal: 15,
    fontSize: 14,
  },
  search: {
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.fieldBorder,
    backgroundColor: C.field,
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  segWrap: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: C.well,
    borderWidth: 1,
    borderColor: "rgba(217,155,105,0.1)",
    padding: 4,
    gap: 4,
    marginBottom: 20,
  },
  seg: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.card,
    padding: 16,
    marginBottom: 11,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  btn: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  langBtn: {
    minWidth: 54,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.accentBorder,
    backgroundColor: "rgba(217,155,105,0.07)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.accentBorder,
    backgroundColor: "rgba(217,155,105,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
});
