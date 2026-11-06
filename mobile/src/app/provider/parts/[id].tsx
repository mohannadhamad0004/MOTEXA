import { Async } from "../../../components/ui/Feedback";
import { ProviderLayout as DashboardLayout } from "../../../components/layout/ProviderLayout";
import { goBack } from "../../../core/hooks/nav";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Button } from "../../../components/ui/Button";
import { typesForCategory } from "../../../features/accessory3d/api";
import { Product, partsShopService } from "../../../features/parts/partsService";
import { ProductForm, blankProduct } from "../../../features/parts/ProductForm";
import { asActor, useSessionUser } from "../../../features/shared/session";

export default function PartDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const isNew = id === "new";
  const state = useLoad(
    () => (isNew ? Promise.resolve(null) : partsShopService.getMyProduct(asActor(user), id)),
    [id, user.id]
  );

  return (
    <DashboardLayout tag="PART / P2" brand="MOTEXA PARTS" title={isNew ? t("Add part", "إضافة قطعة") : t("Edit part", "تعديل القطعة")} back>
      {isNew ? (
        <ProductForm isNew initial={blankProduct} onSubmit={(i) => partsShopService.addProduct(asActor(user), i)} onDone={() => goBack("/provider/parts")} />
      ) : (
        <Async state={state as { data: Product | null; error: string | null; loading: boolean; reload: () => void }}>
          {(p) => (
            <View>
            {/* Feature 2: body kits / exterior accessories / rims can be shown in 3D on the customer's car */}
            {typesForCategory(p.category).length ? (
              <View style={{ marginBottom: 16 }}>
                <Button variant="secondary" icon="cube-outline" label={t("Show it in 3D on customers' cars", "اعرضها ثلاثية الأبعاد على سيارات العملاء")} onPress={() => router.push(`/provider/parts/accessory-3d/${id}`)} />
              </View>
            ) : null}
            <ProductForm
              isNew={false}
              product={p}
              onSubmit={(i) => partsShopService.updateProduct(asActor(user), id, i)}
              onDone={() => goBack("/provider/parts")}
              initial={{
                name: p.name, brand: p.brand, partNumber: p.partNumber, description: p.description,
                price: p.price, stock: p.stock, category: p.category, condition: p.condition, partType: p.partType, imageUri: p.imageUri, fitments: p.fitments, isUniversal: p.isUniversal,
              }}
            />
            </View>
          )}
        </Async>
      )}
    </DashboardLayout>
  );
}
