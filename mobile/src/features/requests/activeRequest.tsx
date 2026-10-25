import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Expand, Icon, Mono, Press, Steps, Tag } from "../../components/blueprint";
import { M } from "../../motion";
import { Text } from "../../components/ui/Text";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useTheme } from "../../theme/useTheme";
import { customerMechanicRequests } from "../mechanics/mechanicsService";
import { customerInquiries, customerTowRequests } from "./requestsService";

/** Short, readable form of a request id for the mono label. */
export const shortId = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

type Active = { key: string; at: string; tag: string; id: string; title: string; labels?: string[]; index?: number; href: string };

/** The customer's most recently updated OPEN tow / mechanic request or ANSWERED question. Null when there is none. */
export function useActiveRequest() {
  const { t } = useL();
  const tows = useLoad(() => customerTowRequests.list(), []);
  const mechs = useLoad(() => customerMechanicRequests.list(), []);
  const asks = useLoad(() => customerInquiries.list(), []);
  const all: Active[] = [];
  for (const r of tows.data ?? []) {
    const i = { REQUESTED: 0, ACCEPTED: 1, EN_ROUTE: 2, IN_PROGRESS: 2 }[r.status as string];
    if (i === undefined) continue;
    const name = r.company.name;
    const title = [
      t(`Waiting for ${name} to answer`, `بانتظار رد ${name}`),
      t(`${name} accepted your request`, `${name} قبلت طلبك`),
      r.status === "IN_PROGRESS" ? t(`${name} is working on your car`, `${name} تعمل على سيارتك`) : t(`${name} is on the way`, `${name} في الطريق إليك`),
    ][i];
    all.push({
      key: "tow" + r.id, at: r.updatedAt, tag: t("Active tow", "سحب نشط"), id: r.id, title, index: i, href: `/customer/towrequest/${r.id}`,
      labels: [t("Requested", "تم الطلب"), t("Accepted", "مقبول"), r.status === "IN_PROGRESS" ? t("In progress", "قيد التنفيذ") : t("On the way", "في الطريق"), t("Completed", "مكتمل")],
    });
  }
  for (const r of mechs.data ?? []) {
    const i = { REQUESTED: 0, ACCEPTED: 1, IN_PROGRESS: 2 }[r.status as string];
    if (i === undefined) continue;
    const name = r.mechanic.name;
    const title = [
      t(`Waiting for ${name} to answer`, `بانتظار رد ${name}`),
      t(`${name} accepted your request`, `${name} قبل طلبك`),
      t(`${name} is working on your car`, `${name} يعمل على سيارتك`),
    ][i];
    all.push({
      key: "mech" + r.id, at: r.updatedAt, tag: t("Active mechanic request", "طلب ميكانيكي نشط"), id: r.id, title, index: i, href: `/customer/mechanicrequest/${r.id}`,
      labels: [t("Requested", "تم الطلب"), t("Accepted", "مقبول"), t("In progress", "قيد التنفيذ"), t("Completed", "مكتمل")],
    });
  }
  for (const q of asks.data ?? []) {
    if (q.status !== "ANSWERED") continue;
    all.push({ key: "ask" + q.id, at: q.updatedAt, tag: t("Answered question", "سؤال تم الرد عليه"), id: q.id, title: t(`${q.shop.name} answered your question about ${q.product.name}`, `${q.shop.name} ردّ على سؤالك عن ${q.product.name}`), href: `/customer/inquiry/${q.id}` });
  }
  all.sort((a, b) => b.at.localeCompare(a.at));
  return { active: all[0] ?? null, reload: () => Promise.allSettled([tows.reload(), mechs.reload(), asks.reload()]) };
}

/** Bronze-bordered card on Home: tag + id, one sentence, progress steps, "View request". */
export function ActiveRequestCard({ a }: { a: Active }) {
  const { c } = useTheme();
  const { t, row, align } = useL();
  // the steps draw in once the card has expanded; later status changes extend the line from the old node
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (a.index === undefined) return;
    const id = setTimeout(() => setShown(a.index!), shown === 0 && a.index > 0 ? M.detail : 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.index]);
  return (
    <Expand style={{ marginBottom: 32 }}>
      <Press accessibilityLabel={a.title} onPress={() => router.push(a.href as never)} style={{ borderRadius: 20, borderWidth: 1, borderColor: c.bronze, backgroundColor: c.field, padding: 16 }}>
        <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 8 }]}>
          <View style={{ flexShrink: 1 }}>
            <Tag color={c.bronze}>{a.tag}</Tag>
          </View>
          <Mono>{shortId(a.id)}</Mono>
        </View>
        <Text style={[{ color: c.ink, fontSize: 15, fontWeight: "700", marginTop: 8 }, align]}>{a.title}</Text>
        {a.labels && a.index !== undefined ? <Steps labels={a.labels} index={Math.min(shown, a.index)} /> : null}
        <View style={[row, { alignItems: "center", gap: 4, marginTop: 16 }]}>
          <Text style={{ color: c.bronze, fontSize: 13, fontWeight: "700" }}>{a.labels ? t("View request", "عرض الطلب") : t("View answer", "عرض الرد")}</Text>
          <Icon name="arrow" size={16} color={c.bronze} />
        </View>
      </Press>
    </Expand>
  );
}
