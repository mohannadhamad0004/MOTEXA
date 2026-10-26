import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { InspectionCheck, Rise, Row, Section, SimplePage, StickyActionBar } from "../../../components/blueprint";
import { Async, Notice } from "../../../components/ui/Feedback";
import { Text } from "../../../components/ui/Text";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService } from "../../../features/catalog/catalogService";
import { useProblemLabels } from "../../../features/requests/requestBits";
import { TowRequestFields, useTowRequestForm } from "../../../features/requests/TowRequestForm";
import { useTheme } from "../../../theme/useTheme";

// The full-screen tow request: three blocks (Pickup, Car and problem, Confirm) and a sticky Send bar. The rules live in
// useTowRequestForm (shared with the map page); a sent request shows a short confirmation, then the status page.
export default function NewTowRequest() {
  const { c, align } = useTheme();
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  const { t, isArabic } = useL();
  const problem = useProblemLabels();
  const state = useLoad(() => catalogService.getTowCompany(companyId), [companyId]);
  const form = useTowRequestForm({ id: companyId, city: state.data?.company.city ?? "" });
  const [sent, setSent] = useState<string | null>(null);

  const send = async () => {
    const r = await form.submit();
    if (!r) return;
    if (r.existing) router.replace({ pathname: "/customer/towrequest/[id]", params: { id: r.id } });
    else setSent(r.id);
  };
  // short success confirmation, then the request itself
  useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => router.replace({ pathname: "/customer/towrequest/[id]", params: { id: sent, created: "1" } }), 1200);
    return () => clearTimeout(id);
  }, [sent]);

  const co = state.data?.company;
  const noTruck = !!co && co.availableTrucks === 0;
  return (
    <SimplePage
      kind="tow"
      tl="TOW / 02"
      tr={co ? cityLabel(co.city, isArabic) : undefined}
      title={sent ? undefined : t("Request a tow", "اطلب سحبًا")}
      back="/customer/tow"
      footer={co && !noTruck && !sent ? <StickyActionBar icon="arrow" label={t("Send request", "إرسال الطلب")} loading={form.busy} road onPress={send} /> : undefined}
    >
      {sent ? (
        <View style={{ alignItems: "center", paddingVertical: 40, gap: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: c.bronze, alignItems: "center", justifyContent: "center" }}>
            <InspectionCheck size={36} color={c.bronze} />
          </View>
          <Text style={{ color: c.ink, fontSize: 24, fontWeight: "700", textAlign: "center" }}>{t("Request sent", "تم إرسال الطلب")}</Text>
          <Text style={{ color: c.soft, fontSize: 14, textAlign: "center" }}>{t("Opening your request…", "جارٍ فتح طلبك…")}</Text>
        </View>
      ) : (
        <Async state={state}>
          {({ company }) =>
            company.availableTrucks === 0 ? (
              <Notice tone="danger" icon="alert-circle-outline">
                {t(`${company.name} has no available truck right now. Please try another company or come back later.`, `لا توجد شاحنة متاحة لدى ${company.name} حاليًا. جرّب شركة أخرى أو عد لاحقًا.`)}
              </Notice>
            ) : (
              <>
                <Notice icon="car-outline">{t(`Request to ${company.name} · ${company.city}`, `طلب إلى ${company.name} · ${company.city}`)}</Notice>
                <TowRequestFields form={form} pinMap />
                <Section n="03" title={t("Confirm", "التأكيد")}>
                  <Row label={t("Company", "الشركة")} value={`${company.name} · ${cityLabel(company.city, isArabic)}`} />
                  <Row label={t("Pickup", "الاستلام")} value={form.pickup.trim()} />
                  <Row label={t("Destination", "الوجهة")} value={form.dropoff.trim()} />
                  <Row label={t("Car", "السيارة")} value={[form.make, form.model, form.year].map((x) => x.trim()).filter(Boolean).join(" ")} />
                  <Row label={t("Problem", "المشكلة")} value={form.problem ? problem[form.problem] : undefined} />
                </Section>
                {form.err ? (
                  <View style={{ marginTop: 16 }}>
                    <Notice tone="danger" icon="alert-circle-outline">{form.err}</Notice>
                  </View>
                ) : null}
                <Text style={[{ color: c.soft, fontSize: 12, marginTop: 16 }, align]}>
                  {t("The company sees your name, your phone and what you wrote here. Your email is never shared.", "ترى الشركة اسمك ورقم هاتفك وما كتبته هنا فقط. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}
                </Text>
              </>
            )
          }
        </Async>
      )}
    </SimplePage>
  );
}
