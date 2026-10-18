import { Async } from "../../../components/ui/Feedback";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { KV } from "../../../components/ui/Rows";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { catalogService } from "../../../features/catalog/catalogService";
import { ProductBrowser } from "../../../features/catalog/ProductBrowser";

/** A shop: its details on top, then its visible parts as the same list as the Parts tab (search, fit, filters, sort, Load more). */
export default function CustomerShop() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const state = useLoad(() => catalogService.getShop(id), [id]);

  return (
    <ProductBrowser
      shopId={id}
      emptyText={t("This shop has no parts listed yet.", "لا توجد قطع معروضة لهذا المتجر بعد.")}
      header={
        <>
          <Header brand="MOTEXA" title={state.data?.shop.name ?? t("Parts shop", "متجر قطع غيار")} back />
          <Async state={state}>
            {({ shop }) => (
              <View>
                <Card>
                  <KV k={t("City", "المدينة")} v={shop.city} />
                  {shop.address ? <KV k={t("Address", "العنوان")} v={shop.address} /> : null}
                </Card>
                <SectionHeader title={t("Parts", "القطع")} />
              </View>
            )}
          </Async>
        </>
      }
    />
  );
}
