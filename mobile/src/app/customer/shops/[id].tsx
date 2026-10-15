import { router, useLocalSearchParams } from "expo-router";
import { ProductCard } from "../../../features/catalog/catalogBits";
import { catalogService } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { Async, Card, Empty, Header, KV, Section, useL, useLoad } from "../../../features/shared/ui";

export default function CustomerShop() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const state = useLoad(() => catalogService.getShop(id), [id]);

  return (
    <CustomerScreen>
      <Header brand="MOTEXA" title={state.data?.shop.name ?? t("Parts shop", "متجر قطع غيار")} back />
      <Async state={state}>
        {({ shop, products }) => (
          <>
            <Card>
              <KV k={t("City", "المدينة")} v={shop.city} />
              {shop.address ? <KV k={t("Address", "العنوان")} v={shop.address} /> : null}
            </Card>
            <Section title={`${t("Parts", "القطع")} (${products.length})`} />
            {products.length ? (
              products.map((p) => <ProductCard key={p.id} p={p} showShop={false} onPress={() => router.push(`/customer/parts/${p.id}`)} />)
            ) : (
              <Empty icon="cube-outline" text={t("This shop has no parts listed yet.", "لا توجد قطع معروضة لهذا المتجر بعد.")} />
            )}
          </>
        )}
      </Async>
    </CustomerScreen>
  );
}
