import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Row, Shop } from "../../../components/blueprint";
import { Async } from "../../../components/ui/Feedback";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
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
      hero={{
        height: 180,
        back: "/customer",
        tl: "SHOP",
        tr: state.data?.shop.city,
        art: (
          <View style={{ height: "100%", aspectRatio: 1.5 }}>
            <Shop />
          </View>
        ),
      }}
      title={state.data?.shop.name ?? t("Parts shop", "متجر قطع غيار")}
      topExtra={
        <Async state={state}>
          {({ shop }) => (
            <View style={{ marginTop: 16 }}>
              <Row label={t("City", "المدينة")} value={shop.city} />
              {shop.address ? <Row label={t("Address", "العنوان")} value={shop.address} /> : null}
            </View>
          )}
        </Async>
      }
      emptyText={t("This shop has no parts listed yet.", "لا توجد قطع معروضة لهذا المتجر بعد.")}
    />
  );
}
