import { Async, EmptyState } from "../../../../components/ui/Feedback";
import { Card } from "../../../../components/ui/Card";
import { DashboardLayout } from "../../../../components/layout/DashboardLayout";
import { Segmented } from "../../../../components/ui/Chip";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { Text } from "../../../../components/ui/Text";
import { useTheme } from "../../../../theme/useTheme";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { InquiryStatusBadge, fmtDateTime } from "../../../../features/requests/requestBits";
import { InquiryStatus, shopInquiries } from "../../../../features/requests/requestsService";

type Filter = "ALL" | InquiryStatus;

// Customer questions about this shop's parts. The customer's name is shown, never their email.
export default function ShopInquiries() {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  const [filter, setFilter] = useState<Filter>("ALL");
  const state = useLoad(() => shopInquiries.list(filter === "ALL" ? undefined : filter), [filter]);

  return (
    <DashboardLayout tag="QUESTIONS / P3" brand="MOTEXA PARTS" title={t("Customer questions", "أسئلة العملاء")} subtitle={t("Answer questions about your parts", "أجب عن الأسئلة حول قطعك")} back>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { key: "ALL", label: t("All", "الكل") },
          { key: "OPEN", label: t("Open", "مفتوحة") },
          { key: "ANSWERED", label: t("Answered", "تم الرد") },
          { key: "CLOSED", label: t("Closed", "مغلقة") },
        ]}
      />
      <Async state={state}>
        {(list) =>
          !list.length ? (
            <EmptyState icon="chatbubbles-outline" text={t("No questions here.", "لا توجد أسئلة هنا.")} />
          ) : (
            list.map((q) => (
              <Card key={q.id} label={q.product.name} onPress={() => router.push(`/provider/parts/inquiries/${q.id}`)}>
                <View style={[row, { justifyContent: "space-between", alignItems: "flex-start", gap: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{q.product.name}</Text>
                    <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{q.customerName}</Text>
                  </View>
                  <InquiryStatusBadge value={q.status} />
                </View>
                {q.lastMessage ? <Text numberOfLines={2} style={[{ color: col.textDim, fontSize: 12, marginTop: 10 }, align]}>{q.lastMessage}</Text> : null}
                <Text style={[{ color: col.textDim, fontSize: 10, marginTop: 8 }, align]}>{fmtDateTime(q.updatedAt)}</Text>
              </Card>
            ))
          )
        }
      </Async>
    </DashboardLayout>
  );
}
