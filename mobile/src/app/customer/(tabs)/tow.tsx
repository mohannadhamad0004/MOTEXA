import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { TowCompanyRow, catalogService } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { C } from "../../../features/shared/palette";
import { Badge, Button, Card, Empty, Header, Notice, SearchBar, useL } from "../../../features/shared/ui";
import { useTruckLabels } from "../../../features/tow/truckBits";

export default function CustomerTow() {
  const { t, row, align } = useL();
  const { type } = useTruckLabels();
  const [city, setCity] = useState("");
  const [items, setItems] = useState<TowCompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(
    async (mode: "replace" | "refresh") => {
      const mine = ++seq.current;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const r = await catalogService.listTowCompanies(city);
        if (mine === seq.current) setItems(r);
      } catch (e: any) {
        if (mine === seq.current) setError(e.message);
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [city]
  );

  useEffect(() => {
    const h = setTimeout(() => run("replace"), 350);
    return () => clearTimeout(h);
  }, [run]);

  return (
    <CustomerScreen tabs refreshing={refreshing} onRefresh={() => run("refresh")}>
      <Header brand="MOTEXA" title={t("Tow companies", "شركات السحب")} subtitle={t("Approved companies and their trucks", "الشركات المعتمدة وشاحناتها")} />
      <SearchBar value={city} onChange={setCity} placeholder={t("Filter by city", "تصفية حسب المدينة")} />

      {loading && !items.length ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={C.accent} />
      ) : error && !items.length ? (
        <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
          <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
          <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" icon="refresh-outline" onPress={() => run("replace")} />
        </View>
      ) : !items.length ? (
        <Empty icon="car-outline" text={city.trim() ? t("No tow companies in this city.", "لا توجد شركات سحب في هذه المدينة.") : t("No tow companies are available yet.", "لا توجد شركات سحب متاحة بعد.")} />
      ) : (
        items.map((c) => (
          <Card key={c.id} label={c.name} onPress={() => router.push(`/customer/tow/${c.id}`)}>
            <View style={[row, { alignItems: "flex-start", gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={[{ color: C.text, fontSize: 16, fontWeight: "800" }, align]}>{c.name}</Text>
                <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 4 }, align]}>{c.city}</Text>
              </View>
              <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
            </View>
            <View style={[row, { flexWrap: "wrap", gap: 6, marginTop: 12 }]}>
              <Badge tone="neutral" icon="car-sport-outline" label={`${c.approvedTrucks} ${c.approvedTrucks === 1 ? t("truck", "شاحنة") : t("trucks", "شاحنات")}`} />
              <Badge tone={c.availableTrucks > 0 ? "success" : "neutral"} icon="radio-button-on" label={`${c.availableTrucks} ${t("available", "متاحة")}`} />
              {c.truckTypes.map((k) => (
                <Badge key={k} tone="accent" label={type[k]} />
              ))}
            </View>
          </Card>
        ))
      )}
    </CustomerScreen>
  );
}
