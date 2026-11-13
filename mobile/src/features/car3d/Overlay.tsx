import { ActivityIndicator, View } from "react-native";
import { GButton, GText } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { gType, useGarageTheme } from "../../theme/garage";

/** Spinner until the first frame; on failure (usually no internet for three.js) a short message + Retry. Once a frame has been
 *  drawn the view works: a later error never covers it. */
export function Overlay({ shown, error, onRetry, interactive }: { shown: boolean; error: string | null; onRetry: () => void; interactive: boolean }) {
  const { g } = useGarageTheme();
  const { t } = useL();
  if (shown) return null;
  return (
    <View pointerEvents={error ? "auto" : "none"} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 }}>
      {error ? (
        <>
          <GText soft style={[gType.caption, { textAlign: "center" }]}>{t("Couldn't load the 3D view. Check your internet connection.", "تعذّر تحميل العرض ثلاثي الأبعاد. تحقق من اتصالك بالإنترنت.")}</GText>
          {interactive ? <GButton variant="secondary" icon="refresh" label={t("Retry", "إعادة المحاولة")} onPress={onRetry} /> : null}
        </>
      ) : (
        <ActivityIndicator color={g.accent} />
      )}
    </View>
  );
}
