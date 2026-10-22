import { Async, EmptyState } from "../../../components/ui/Feedback";
import { Card } from "../../../components/ui/Card";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { SearchBar } from "../../../components/ui/Input";
import { Segmented } from "../../../components/ui/Chip";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { partsAdminService } from "../../../features/parts/partsService";
import { VerificationBadge } from "../../../features/shared/blocks";
import { asActor, useSessionUser } from "../../../features/shared/session";

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export default function AdminShopsList() {
  const { c: col } = useTheme();
  const user = useSessionUser();
  const { t, row, align } = useL();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const state = useLoad(() => partsAdminService.listShops(asActor(user)), [user.id]);

  return (
    <DashboardLayout kind="shop" tag="REVIEW / A3" brand="MOTEXA ADMIN"
        title={t("Parts Shops", "متاجر قطع الغيار")}
        subtitle={t("Review shops applying to operate on MOTEXA", "مراجعة المتاجر الراغبة بالعمل على MOTEXA")}
        back
        signOutButton>
      <SearchBar value={q} onChange={setQ} placeholder={t("Shop, owner, phone or city", "المتجر أو المالك أو الهاتف أو المدينة")} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { key: "ALL", label: t("All", "الكل") },
          { key: "PENDING", label: t("Pending", "قيد المراجعة") },
          { key: "APPROVED", label: t("Approved", "معتمد") },
          { key: "REJECTED", label: t("Rejected", "مرفوض") },
        ]}
      />
      <Async state={state}>
        {(shops) => {
          const n = q.trim().toLowerCase();
          const rows = shops.filter(
            (s) =>
              (filter === "ALL" || s.verification === filter) &&
              (!n || [s.name, s.ownerName, s.phone, s.city].some((x) => x.toLowerCase().includes(n)))
          );
          if (!rows.length) return <EmptyState icon="storefront-outline" text={t("No shops match.", "لا توجد متاجر مطابقة.")} />;
          return rows.map((s) => (
            <Card key={s.id} label={s.name} onPress={() => router.push(`/admin/shops/${s.id}`)}>
              <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: col.text, fontSize: 16, fontWeight: "800" }, align]}>{s.name}</Text>
                  <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 4 }, align]}>
                    {s.ownerName} · {s.phone}
                  </Text>
                  <Text numberOfLines={1} style={[{ color: col.textDim, fontSize: 12, marginTop: 2 }, align]}>{s.city}</Text>
                </View>
                <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={col.accent} />
              </View>
              <View style={{ marginTop: 12 }}>
                <VerificationBadge value={s.verification} />
              </View>
            </Card>
          ));
        }}
      </Async>
    </DashboardLayout>
  );
}
