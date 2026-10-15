import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ReviewStatus, mechanicReviewService } from "../../../../features/mechanic-review/mechanicReviewService";
import { ReviewStatusBadge, useReviewLabels } from "../../../../features/mechanic-review/reviewBits";
import { fmtDate } from "../../../../features/shared/blocks";
import { C } from "../../../../features/shared/palette";
import { Async, Card, Empty, Header, Screen, SearchBar, useL, useLoad } from "../../../../features/shared/ui";

type Filter = ReviewStatus | "ALL";
const FILTERS: Filter[] = ["ALL", "PENDING_REVIEW", "NEEDS_CORRECTION", "MANUAL_REVIEW", "READY_FOR_AUTHORITY"];

export default function MechanicApplicationsList() {
  const { t, row, align, isArabic } = useL();
  const labels = useReviewLabels().status;
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const state = useLoad(() => mechanicReviewService.list(filter, query), [filter, query]);

  return (
    <Screen>
      <Header
        brand="MOTEXA ADMIN"
        title={t("Mechanic Applications", "طلبات الميكانيكيين")}
        subtitle={t("Review submitted mechanic applications", "مراجعة طلبات الميكانيكيين المقدّمة")}
        back
      />
      <SearchBar value={q} onChange={setQ} placeholder={t("Name, email, ID or licence number", "الاسم أو البريد أو الرقم أو رقم الرخصة")} />

      {/* Five labels do not fit one row at phone width, so the filters scroll horizontally. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }} contentContainerStyle={[row, { gap: 8 }]}>
        {FILTERS.map((f) => {
          const on = f === filter;
          return (
            <TouchableOpacity
              key={f}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f)}
              style={{
                minHeight: 44, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, justifyContent: "center",
                borderColor: on ? C.accent : "rgba(217,155,105,0.14)", backgroundColor: on ? C.accent : C.well,
              }}
            >
              <Text style={{ color: on ? C.onAccent : "#8F7D71", fontSize: 12, fontWeight: "800" }}>
                {f === "ALL" ? t("All", "الكل") : labels[f]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Async state={state}>
        {(rows) =>
          !rows.length ? (
            <Empty icon="document-text-outline" text={t("No applications match.", "لا توجد طلبات مطابقة.")} />
          ) : (
            rows.map((a) => (
              <Card key={a.id} label={a.applicantName} onPress={() => router.push(`/admin/mechanics/applications/${a.id}`)}>
                <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={[{ color: C.text, fontSize: 16, fontWeight: "800" }, align]}>{a.applicantName}</Text>
                    <Text numberOfLines={2} style={[{ color: C.textMuted, fontSize: 12, marginTop: 4 }, align]}>
                      {a.skills.join(" • ")}
                    </Text>
                    <Text numberOfLines={1} style={[{ color: C.textDim, fontSize: 12, marginTop: 2 }, align]}>{a.workshopName}</Text>
                  </View>
                  <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={19} color={C.accent} />
                </View>
                <View style={[row, { flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }]}>
                  <ReviewStatusBadge value={a.reviewStatus} />
                  <Text style={{ color: C.textDim, fontSize: 11, marginHorizontal: 4 }}>
                    {t("Submitted", "قُدّم في")} {fmtDate(a.submittedAt)} · {a.id.slice(0, 8)}
                  </Text>
                </View>
              </Card>
            ))
          )
        }
      </Async>
    </Screen>
  );
}
