import { useEffect, useState } from "react";
import { View } from "react-native";
import { Mono } from "../../components/blueprint";
import { Text } from "../../components/ui/Text";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";
import { LatLng, RouteResult, cachedRoute, getRoute, routeCacheKey } from "./routing";

/**
 * The route from a pickup point to a provider for one request: a road route from OSRM, or a straight line when OSRM
 * is offline / slow. `route` is null while the first answer is on its way. Cached per request for the session.
 */
export function useRoute(requestId: string | null, from: LatLng | null, to: LatLng | null) {
  const key = requestId && from && to ? routeCacheKey(requestId, from, to) : null;
  const [route, setRoute] = useState<RouteResult | null>(key ? cachedRoute(key) : null);
  const [loading, setLoading] = useState(!!key && !(key && cachedRoute(key)));
  useEffect(() => {
    if (!key || !from || !to) {
      setRoute(null);
      setLoading(false);
      return;
    }
    const hit = cachedRoute(key);
    if (hit) {
      setRoute(hit);
      setLoading(false);
      return;
    }
    let live = true;
    setRoute(null);
    setLoading(true);
    getRoute(key, from, to).then((r) => {
      if (live) {
        setRoute(r);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { route, loading };
}

/** "≈ 12.3 km by road" + "Estimated drive time (no traffic) ≈ 18 min", or "Straight line ≈ 10 km". Honest labels only. */
export function RouteSummary({ route, loading }: { route: RouteResult | null; loading: boolean }) {
  const { c, row, align } = useTheme();
  const { t, isArabic } = useL();
  if (loading || !route)
    return <Text style={[{ color: c.soft, fontSize: 12 }, align]}>{loading ? t("Finding the route…", "جارٍ حساب المسار…") : ""}</Text>;
  const km = route.km < 10 ? route.km.toFixed(1) : String(Math.round(route.km));
  const unit = isArabic ? "كم" : "km";
  return (
    <View style={{ gap: 4 }}>
      <View style={[row, { alignItems: "baseline", gap: 6 }]}>
        <Mono color={c.ink} size={14} bold>{`≈ ${km} ${unit}`}</Mono>
        <Text style={{ color: c.soft, fontSize: 12 }}>{route.kind === "road" ? t("by road", "بالطريق") : t("straight line", "خط مستقيم")}</Text>
      </View>
      {route.kind === "road" && route.minutes !== null ? (
        <View style={[row, { alignItems: "baseline", gap: 6, flexWrap: "wrap" }]}>
          <Text style={{ color: c.soft, fontSize: 12 }}>{t("Estimated drive time (no traffic)", "وقت القيادة التقديري (بدون ازدحام)")}</Text>
          <Mono size={12}>{`≈ ${route.minutes} ${isArabic ? "د" : "min"}`}</Mono>
        </View>
      ) : null}
      {route.kind === "line" ? <Text style={[{ color: c.soft, fontSize: 11 }, align]}>{t("The road route is not available right now.", "مسار الطريق غير متاح حاليًا.")}</Text> : null}
    </View>
  );
}
