// Customer questions about this shop's parts = List: search, ONE chip row All · Open · Answered · Closed with counts, open ones first,
// ⋮ per row. The customer's name is shown, never their email.
import { router, type Href } from "expo-router";
import { useState } from "react";
import { FilterChips, ManagePage, ManageRow } from "../../../../components/manage/ManagePage";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { shopInquiryActions } from "../../../../features/parts/provider/shopActions";
import { fmtDateTime } from "../../../../features/requests/requestBits";
import { InquiryStatus, shopInquiries } from "../../../../features/requests/requestsService";
import { inquiryStatus } from "../../../../features/requests/inquiryStatus";

type Filter = "ALL" | InquiryStatus;
const ORDER: Record<InquiryStatus, number> = { OPEN: 0, ANSWERED: 1, CLOSED: 2 };

export default function ShopInquiries() {
  const { t } = useL();
  const [filter, setFilter] = useState<Filter>("ALL"), [q, setQ] = useState("");
  const state = useLoad(() => shopInquiries.list(), [], 30000);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (state.data ?? []).filter((x) => words.every((w) => `${x.product.name} ${x.customerName} ${x.lastMessage ?? ""}`.toLowerCase().includes(w)));
  const rows = found.filter((x) => filter === "ALL" || x.status === filter).sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt.localeCompare(a.updatedAt));
  const n = (s: InquiryStatus) => found.filter((x) => x.status === s).length;
  return (
    <ManagePage title={t("Customer questions", "أسئلة العملاء")} line={state.data ? t(`${n("OPEN")} waiting for your answer`, `${n("OPEN")} بانتظار ردك`) : undefined}
      search={{ value: q, onChange: setQ, placeholder: t("Part, customer or message", "القطعة أو العميل أو الرسالة") }}
      filters={<FilterChips value={filter} onChange={setFilter} filters={[{ key: "ALL", label: t("All", "الكل"), count: found.length }, { key: "OPEN", label: t("Open", "مفتوحة"), count: n("OPEN") },
        { key: "ANSWERED", label: t("Answered", "تم الرد"), count: n("ANSWERED") }, { key: "CLOSED", label: t("Closed", "مغلقة"), count: n("CLOSED") }]} />}
      items={rows} keyOf={(x) => x.id}
      renderItem={(x) => <ManageRow title={x.product.name} sub={[x.customerName, x.lastMessage, fmtDateTime(x.updatedAt)].filter(Boolean).join(" · ")} status={inquiryStatus(x.status, t)}
        onPress={() => router.push(`/provider/parts/inquiries/${x.id}` as Href)} actions={shopInquiryActions(t, x, state.reload)} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q || filter !== "ALL" ? t("No question matches.", "لا يوجد سؤال مطابق.") : t("No questions here.", "لا توجد أسئلة هنا.") }}
      onRefresh={() => void state.reload()} refreshing={false} detailHint={t("Tap a question to answer it.", "اضغط على سؤال للرد عليه.")} />
  );
}
