import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { PrimaryButton, SimplePage } from "../../../components/blueprint";
import { Async, Notice } from "../../../components/ui/Feedback";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService } from "../../../features/catalog/catalogService";
import { TowRequestFields, useTowRequestForm } from "../../../features/requests/TowRequestForm";

// The full-screen tow request form. The rules live in useTowRequestForm (shared with the map page).
export default function NewTowRequest() {
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  const { t } = useL();
  const state = useLoad(() => catalogService.getTowCompany(companyId), [companyId]);
  const form = useTowRequestForm({ id: companyId, city: state.data?.company.city ?? "" });

  const send = async () => {
    const r = await form.submit();
    if (r) router.replace({ pathname: "/customer/towrequest/[id]", params: r.existing ? { id: r.id } : { id: r.id, created: "1" } });
  };

  return (
    <SimplePage kind="tow" tl="TOW / 02" tr={state.data ? state.data.company.city : undefined} title={t("Request a tow", "اطلب سحبًا")} back="/customer/tow">
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
              {form.err ? <Notice tone="danger" icon="alert-circle-outline">{form.err}</Notice> : null}
              <View style={{ height: 8 }} />
              <PrimaryButton icon="arrow" label={t("Send request", "إرسال الطلب")} loading={form.busy} onPress={send} />
              <View style={{ height: 12 }} />
              <Notice icon="information-circle-outline">
                {t("The company sees your name, your phone and what you wrote here. Your email is never shared.", "ترى الشركة اسمك ورقم هاتفك وما كتبته هنا فقط. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}
              </Notice>
            </>
          )
        }
      </Async>
    </SimplePage>
  );
}
