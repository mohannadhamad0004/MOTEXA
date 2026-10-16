import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Chip, ChipRow } from "../../../features/catalog/catalogBits";
import { TowCompanyRow, catalogService } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { C } from "../../../features/shared/palette";
import { Badge, Button, Card, Empty, Header, Notice, SearchBar, Section, useL } from "../../../features/shared/ui";
import { useTruckLabels } from "../../../features/tow/truckBits";
import type { TruckType } from "../../../features/tow/towService";

const TRUCK_TYPES: TruckType[] = ["FLATBED", "HOOK_CHAIN", "WHEEL_LIFT", "HEAVY_DUTY"];

export default function CustomerTow() {
  const { t, row, align } = useL();
  const { type } = useTruckLabels();
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [truckType, setTruckType] = useState<TruckType | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<"available" | "name">("available");
  const filtered = !!(city.trim() || name.trim() || truckType || availableOnly);
  const showAll = () => {
    setCity("");
    setName("");
    setTruckType(null);
    setAvailableOnly(false);
  };
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
        const r = await catalogService.listTowCompanies({ city, q: name, truckType: truckType ?? undefined, availableOnly, sort });
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
    [city, name, truckType, availableOnly, sort]
  );

  useEffect(() => {
    const h = setTimeout(() => run("replace"), 350);
    return () => clearTimeout(h);
  }, [run]);

  return (
    <CustomerScreen tabs refreshing={refreshing} onRefresh={() => run("refresh")}>
      <Header brand="MOTEXA" title={t("Tow companies", "شركات السحب")} subtitle={t("Approved companies and their trucks", "الشركات المعتمدة وشاحناتها")} />
      <SearchBar value={name} onChange={setName} placeholder={t("Company name", "اسم الشركة")} />
      <SearchBar value={city} onChange={setCity} placeholder={t("Filter by city", "تصفية حسب المدينة")} />
      <ChipRow>
        <Chip label={t("All types", "كل الأنواع")} on={truckType === null} onPress={() => setTruckType(null)} />
        {TRUCK_TYPES.map((k) => (
          <Chip key={k} label={type[k]} on={truckType === k} onPress={() => setTruckType(truckType === k ? null : k)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip icon="radio-button-on" label={t("Available now", "متاح الآن")} on={availableOnly} onPress={() => setAvailableOnly(!availableOnly)} />
        <Chip label={t("Most trucks available", "الأكثر شاحنات متاحة")} on={sort === "available"} onPress={() => setSort("available")} />
        <Chip label={t("Name", "الاسم")} on={sort === "name"} onPress={() => setSort("name")} />
      </ChipRow>

      {loading && !items.length ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={C.accent} />
      ) : error && !items.length ? (
        <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
          <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
          <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" icon="refresh-outline" onPress={() => run("replace")} />
        </View>
      ) : !items.length ? (
        <>
          <Empty icon="car-outline" text={filtered ? t("No tow companies cover this area yet.", "لا توجد شركات سحب تغطي هذه المنطقة بعد.") : t("No tow companies are available yet.", "لا توجد شركات سحب متاحة بعد.")} />
          {filtered ? <Button variant="ghost" icon="close-circle-outline" label={t("Show all", "عرض الكل")} onPress={showAll} /> : null}
        </>
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

      <Section title={t("While you wait", "أثناء الانتظار")} />
      <Card>
        {[
          t("Turn on your hazard lights.", "شغّل أضواء التحذير."),
          t("Stay off the road: wait behind the barrier or well away from traffic.", "ابتعد عن الطريق: انتظر خلف الحاجز أو بعيدًا عن حركة السير."),
          t("Keep your phone charged, and keep it with you.", "أبقِ هاتفك مشحونًا واحتفظ به معك."),
        ].map((tip, i) => (
          <View key={i} style={[row, { alignItems: "flex-start", gap: 10, paddingVertical: 6 }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.accent} style={{ marginTop: 2 }} />
            <Text style={[{ color: C.text, fontSize: 13, lineHeight: 19, flex: 1 }, align]}>{tip}</Text>
          </View>
        ))}
      </Card>
    </CustomerScreen>
  );
}
