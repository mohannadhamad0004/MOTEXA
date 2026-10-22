import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { Tone, useTones } from "./Badge";
import { SkeletonList } from "./Skeleton";
import { useTheme } from "../../theme/useTheme";
import { useL } from "../../core/hooks/useL";

type IconName = keyof typeof Ionicons.glyphMap;

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 44 }}>
      <Ionicons name={icon} size={34} color={c.textDim} />
      <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 10, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  const { c } = useTheme();
  const { t } = useL();
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, gap: 14 }}>
      <Text style={{ color: c.textMuted, fontSize: 13, textAlign: "center" }}>
        {message ?? t("Could not load data.", "تعذّر تحميل البيانات.")}
      </Text>
      <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" onPress={onRetry} icon="refresh-outline" />
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
  const k = useTones()[tone];
  const { row, align } = useTheme();
  return (
    <View
      style={[row, { gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: k.bg, borderColor: k.border, marginBottom: 12 }]}
    >
      <Ionicons name={icon} size={18} color={k.fg} />
      <Text style={[{ color: k.fg, fontSize: 12, lineHeight: 18, flex: 1 }, align]}>{children}</Text>
    </View>
  );
}

/** Loading (skeleton) / error / content wrapper for useLoad(). */
export function Async<T>({
  state,
  children,
}: {
  state: { data: T | null; error: string | null; loading: boolean; reload: () => void };
  children: (d: T) => ReactNode;
}) {
  if (state.loading && !state.data) return <SkeletonList />;
  if (state.error || !state.data) return <ErrorState message={state.error} onRetry={state.reload} />;
  return <>{children(state.data)}</>;
}
