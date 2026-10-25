import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { PrimaryButton, SimplePage, Stamp } from "../../../components/blueprint";
import { Async, Notice } from "../../../components/ui/Feedback";
import { Text } from "../../../components/ui/Text";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { MechanicRequestFields, useMechanicRequestForm } from "../../../features/mechanics/MechanicRequestForm";
import { mechanicCatalog } from "../../../features/mechanics/mechanicsService";
import { useTheme } from "../../../theme/useTheme";

// A service request to one verified mechanic. The mechanic answers inside the app; nothing here is a price or a promise of a time.
export default function NewMechanicRequest() {
  const { c } = useTheme();
  const { mechanicId } = useLocalSearchParams<{ mechanicId: string }>();
  const { t, isArabic } = useL();
  const state = useLoad(() => mechanicCatalog.get(mechanicId), [mechanicId]);
  const form = useMechanicRequestForm({ id: mechanicId, city: state.data?.city ?? "" });
  const [sentId, setSentId] = useState<string | null>(null);

  const send = async () => {
    const r = await form.submit();
    if (r) setSentId(r.id);
  };

  return (
    <SimplePage kind="wrench" tl="MECHANICS / 04" tr={state.data ? cityLabel(state.data.city, isArabic) : undefined} title={t("Request service", "طلب خدمة")} back="/customer/mechanics">
      <Async state={state}>
        {(m) =>
          sentId ? (
            <View style={{ marginTop: 24 }}>
              <View style={{ alignItems: "center", paddingVertical: 14, gap: 12 }}>
                <Stamp label={t("Sent", "أُرسل")} />
                <Text style={{ color: c.ink, fontSize: 20, fontWeight: "700", textAlign: "center" }}>{t("Request sent", "تم إرسال الطلب")}</Text>
                <Text style={{ color: c.soft, fontSize: 14, lineHeight: 22, textAlign: "center" }}>
                  {t(`${m.name} will accept or decline it. You can follow its status here.`, `سيقبل ${m.name} الطلب أو يرفضه. يمكنك متابعة حالته هنا.`)}
                </Text>
              </View>
              <PrimaryButton icon="arrow" label={t("View request", "عرض الطلب")} onPress={() => router.replace(`/customer/mechanicrequest/${sentId}`)} />
            </View>
          ) : (
            <>
              <MechanicRequestFields form={form} skills={m.skills} pinMap />
              <View style={{ height: 8 }} />
              {form.err ? <Notice tone="danger" icon="alert-circle-outline">{form.err}</Notice> : null}
              <PrimaryButton icon="arrow" label={t("Send request", "إرسال الطلب")} loading={form.busy} road onPress={send} />
              <View style={{ height: 12 }} />
              <Notice icon="information-circle-outline">
                {t("The mechanic sees your name, your car, the problem and the location you wrote. Your email is never shared.", "يرى الميكانيكي اسمك وسيارتك والمشكلة والموقع الذي كتبته. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}
              </Notice>
            </>
          )
        }
      </Async>
    </SimplePage>
  );
}
