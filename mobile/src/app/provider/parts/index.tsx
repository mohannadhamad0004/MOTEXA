import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { StockBadge, fitmentSummary } from "../../../features/parts/partsBits";
import { Product, partsShopService, stockState } from "../../../features/parts/partsService";
import { VerificationBadge } from "../../../features/shared/blocks";
import { formatPrice } from "../../../features/shared/money";
import { C } from "../../../features/shared/palette";
import { asActor, useSessionUser } from "../../../features/shared/session";
import {
  Async, Badge, Button, Card, Empty, Header, Notice, Screen, SearchBar, Segmented, Thumb, useL, useLoad,
} from "../../../features/shared/ui";

type Filter = "ALL" | "IN" | "LOW" | "OUT";

export default function MyParts() {
  const user = useSessionUser();
  const { t, row, align } = useL();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const state = useLoad(() => partsShopService.getMyInventory(asActor(user)), [user.id]);

  return (
    <Screen>
      <Header
        brand="MOTEXA PARTS"
        title={t("My Parts", "قطعي")}
        subtitle={state.data ? state.data.shop.name : undefined}
        signOutButton
      />
      <Async state={state}>
        {({ shop, products }) => {
          const n = q.trim().toLowerCase();
          const rows = products.filter(
            (p) =>
              (filter === "ALL" || stockState(p.stock) === filter) &&
              (!n || [p.name, p.brand, p.partNumber].some((x) => x.toLowerCase().includes(n)))
          );
          return (
            <>
              {shop.verification !== "APPROVED" && (
                <View style={{ marginBottom: 12 }}>
                  <VerificationBadge value={shop.verification} prefix={t("Shop", "المتجر")} />
                </View>
              )}
              <Button variant="ghost" label={t("Customer questions", "أسئلة العملاء")} icon="chatbubbles-outline" onPress={() => router.push("/provider/parts/inquiries")} />
              <View style={{ height: 10 }} />
              <Button label={t("Add part", "إضافة قطعة")} icon="add-circle-outline" onPress={() => router.push("/provider/parts/new")} />
              <View style={{ height: 16 }} />
              <SearchBar value={q} onChange={setQ} placeholder={t("Name, brand or part number", "الاسم أو العلامة أو رقم القطعة")} />
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { key: "ALL", label: t("All", "الكل") },
                  { key: "IN", label: t("In stock", "متوفر") },
                  { key: "LOW", label: t("Low", "منخفض") },
                  { key: "OUT", label: t("Out", "نفد") },
                ]}
              />
              {!rows.length ? (
                <Empty icon="cube-outline" text={products.length ? t("No parts match.", "لا توجد قطع مطابقة.") : t("You have no parts yet. Add your first part.", "لا توجد قطع بعد. أضف أول قطعة.")} />
              ) : (
                rows.map((p) => (
                  <Card key={p.id} label={p.name} onPress={() => router.push(`/provider/parts/${p.id}`)}>
                    <View style={[row, { gap: 14 }]}>
                      <Thumb uri={p.imageUri} icon="cube-outline" size={64} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{p.name}</Text>
                        <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                          {p.brand} · {p.partNumber}
                        </Text>
                        <Text numberOfLines={1} style={[{ color: C.textDim, fontSize: 12, marginTop: 2 }, align]}>{fitmentSummary(p, t)}</Text>
                      </View>
                    </View>
                    <View style={[row, { flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 12 }]}>
                      <Text style={{ color: C.accent, fontSize: 15, fontWeight: "800", marginHorizontal: 4 }}>
                        {formatPrice(p.price)}
                      </Text>
                      <Badge tone="neutral" label={`${t("Qty", "الكمية")} ${p.stock}`} />
                      <StockBadge stock={p.stock} />
                    </View>
                    {p.hidden && (
                      <View style={{ marginTop: 12 }}>
                        <Notice tone="danger" icon="eye-off-outline">
                          {t("Hidden by MOTEXA", "مخفية بواسطة MOTEXA")}
                          {p.hiddenReason ? "\n" + p.hiddenReason : ""}
                        </Notice>
                      </View>
                    )}
                  </Card>
                ))
              )}
            </>
          );
        }}
      </Async>
    </Screen>
  );
}
