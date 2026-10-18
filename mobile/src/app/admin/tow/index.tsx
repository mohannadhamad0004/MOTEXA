import { Async, EmptyState } from "../../../components/ui/Feedback";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { Screen } from "../../../components/layout/Screen";
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
import { VerificationBadge } from "../../../features/shared/blocks";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { towAdminService } from "../../../features/tow/towService";
import { useTruckLabels } from "../../../features/tow/truckBits";

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export default function AdminTowList() {
  const { c: col } = useTheme();
  const user = useSessionUser();
  const { t, row, align } = useL();
  const { type } = useTruckLabels();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");

  const state = useLoad(async () => {
    const a = asActor(user);
    const [companies, trucks] = await Promise.all([towAdminService.listCompanies(a), towAdminService.listTrucks(a)]);
    return { companies, trucks };
  }, [user.id]);

  return (
    <Screen>
      <Header
        brand="MOTEXA ADMIN"
        title={t("Tow Companies", "شركات السحب")}
        subtitle={t("Review tow companies and their trucks", "مراجعة شركات السحب وشاحناتها")}
        back
        signOutButton
      />
      <SearchBar value={q} onChange={setQ} placeholder={t("Company, plate or truck type", "الشركة أو اللوحة أو نوع الشاحنة")} />
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
        {({ companies, trucks }) => {
          const needle = q.trim().toLowerCase();
          const rows = companies.filter((c) => {
            if (filter !== "ALL" && c.verification !== filter) return false;
            if (!needle) return true;
            return (
              c.name.toLowerCase().includes(needle) ||
              trucks.some(
                (tr) =>
                  tr.companyId === c.id &&
                  (tr.plate.toLowerCase().includes(needle) ||
                    tr.type.toLowerCase().includes(needle) ||
                    type[tr.type].toLowerCase().includes(needle))
              )
            );
          });
          if (!rows.length) return <EmptyState icon="car-outline" text={t("No tow companies match.", "لا توجد شركات مطابقة.")} />;
          return rows.map((c) => (
            <Card key={c.id} label={c.name} onPress={() => router.push(`/admin/tow/${c.id}`)}>
              <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: col.text, fontSize: 16, fontWeight: "800" }, align]}>{c.name}</Text>
                  <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 4 }, align]}>
                    {c.contactName} · {c.phone}
                  </Text>
                  <Text numberOfLines={1} style={[{ color: col.textDim, fontSize: 12, marginTop: 2 }, align]}>{c.city}</Text>
                </View>
                <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={col.accent} />
              </View>
              <View style={[row, { flexWrap: "wrap", gap: 6, marginTop: 12 }]}>
                <VerificationBadge value={c.verification} />
                <Badge tone="neutral" icon="car-sport-outline" label={`${c.truckCount} ${c.truckCount === 1 ? t("truck", "شاحنة") : t("trucks", "شاحنات")}`} />
                {c.pendingTruckCount > 0 && (
                  <Badge tone="accent" icon="time-outline" label={`${c.pendingTruckCount} ${t("pending", "قيد المراجعة")}`} />
                )}
              </View>
            </Card>
          ));
        }}
      </Async>
    </Screen>
  );
}
