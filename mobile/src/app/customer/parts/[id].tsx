import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { catalogService } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { StockStateBadge } from "../../../features/parts/partsBits";
import { C } from "../../../features/shared/palette";
import { Async, Button, Card, Header, Section, Thumb, useL, useLoad } from "../../../features/shared/ui";

export default function CustomerPartDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align } = useL();
  const state = useLoad(() => catalogService.getPart(id), [id]);

  return (
    <CustomerScreen>
      <Header brand="MOTEXA" title={t("Part details", "تفاصيل القطعة")} back />
      <Async state={state}>
        {(p) => (
          <>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Thumb uri={p.imageUri} icon="cube-outline" size={150} />
            </View>
            <Text style={[{ color: C.text, fontSize: 21, fontWeight: "800" }, align]}>{p.name}</Text>
            <Text style={[{ color: C.textMuted, fontSize: 13, marginTop: 4 }, align]}>
              {p.brand} · {p.partNumber}
            </Text>
            <View style={[row, { flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 }]}>
              <Text style={{ color: C.accent, fontSize: 22, fontWeight: "800", marginHorizontal: 4 }}>{p.price.toFixed(2)}</Text>
              <StockStateBadge state={p.stock} />
            </View>

            {p.description ? (
              <>
                <Section title={t("Description", "الوصف")} />
                <Card>
                  <Text style={[{ color: C.text, fontSize: 13, lineHeight: 20 }, align]}>{p.description}</Text>
                </Card>
              </>
            ) : null}

            <Section title={t("Fits these vehicles", "تناسب هذه المركبات")} />
            <Card>
              {p.fitments.length ? (
                p.fitments.map((f, i) => (
                  <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: "rgba(217,155,105,0.10)" }}>
                    <Text style={[{ color: C.text, fontSize: 13, fontWeight: "700" }, align]}>
                      {f.make} {f.model}
                    </Text>
                    <Text style={[{ color: C.textMuted, fontSize: 12, marginTop: 2 }, align]}>
                      {f.yearFrom}–{f.yearTo}
                      {f.trim ? ` · ${f.trim}` : ""}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[{ color: C.textMuted, fontSize: 13 }, align]}>{t("No fitment listed", "لا يوجد توافق محدد")}</Text>
              )}
            </Card>

            <Section title={t("Sold by", "يُباع بواسطة")} />
            <Card label={p.shop.name} onPress={() => router.push(`/customer/shops/${p.shop.id}`)}>
              <View style={[row, { alignItems: "center", gap: 12 }]}>
                <Ionicons name="storefront-outline" size={24} color={C.accent} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{p.shop.name}</Text>
                  <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>{p.shop.city}</Text>
                </View>
                <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
              </View>
            </Card>

            <View style={{ height: 8 }} />
            <Button icon="chatbubble-ellipses-outline" label={t("Ask the shop", "اسأل المتجر")} onPress={() => router.push({ pathname: "/customer/inquiry/new", params: { productId: p.id } })} />
          </>
        )}
      </Async>
    </CustomerScreen>
  );
}
