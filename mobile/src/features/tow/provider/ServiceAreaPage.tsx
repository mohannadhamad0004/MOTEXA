// Service area = a Detail with the map as its body: the base point, the base city and the extra service cities; Edit in the footer
// (the business info form holds both).
import { router, type Href } from "expo-router";
import { GButton, Note } from "../../../components/garage";
import { Block, Facts, Loaded, Page } from "../../../components/manage/Page";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { asActor, useSessionUser } from "../../../core/session/session";
import { MAPS_AVAILABLE, PinMap } from "../../shared/maps";
import { towFleetService } from "../towService";

export default function ServiceAreaPage() {
  const { t, isArabic } = useL();
  const u = useSessionUser();
  const state = useLoad(() => towFleetService.getMyFleet(asActor(u)), [u.id]);
  return (
    <Page title={t("Service area", "منطقة الخدمة")} line={state.data ? cityLabel(state.data.company.city, isArabic) : undefined} onRefresh={() => void state.reload()} refreshing={false}
      footer={<GButton icon="create-outline" label={t("Edit service area and base location", "تعديل منطقة الخدمة والموقع")} onPress={() => router.push("/provider/tow/company" as Href)} />}>
      <Loaded state={state}>{({ company: c }) => (
        <>
          {MAPS_AVAILABLE && c.baseLat !== null && c.baseLng !== null ? <PinMap point={{ lat: c.baseLat, lng: c.baseLng }} height={260} />
            : <Note icon="location-outline">{t("No base location yet. Customers see the city centre instead.", "لا يوجد موقع قاعدة بعد. يرى العملاء مركز المدينة بدلًا منه.")}</Note>}
          <Block>
            <Facts rows={[[t("Based in", "المقر"), cityLabel(c.city, isArabic)],
              [t("Also serves", "تخدم أيضًا"), c.serviceCities.length ? c.serviceCities.map((x) => cityLabel(x, isArabic)).join(" · ") : t("No additional service cities selected.", "لم تُحدّد مدن خدمة إضافية.")]]} />
          </Block>
        </>
      )}</Loaded>
    </Page>
  );
}
