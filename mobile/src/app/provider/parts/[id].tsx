import { Async } from "../../../components/ui/Feedback";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { goBack } from "../../../core/hooks/nav";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useLocalSearchParams } from "expo-router";
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
          )}
        </Async>
      )}
    </DashboardLayout>
  );
}
