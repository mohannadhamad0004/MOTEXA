// Add / edit a part (Form step flow, features/parts/ProductForm). Showing it in 3D is a secondary action in ⋮.
import { router, useLocalSearchParams } from "expo-router";
import { Note, SkeletonRows } from "../../../components/garage";
import { Page } from "../../../components/manage/Page";
import { goBack } from "../../../core/hooks/nav";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { typesForCategory } from "../../../features/accessory3d/api";
import { partsShopService } from "../../../features/parts/partsService";
import { ProductForm, blankProduct } from "../../../features/parts/ProductForm";
import { asActor, useSessionUser } from "../../../features/shared/session";

export default function PartDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const isNew = id === "new";
  const state = useLoad(() => (isNew ? Promise.resolve(null) : partsShopService.getMyProduct(asActor(user), id)), [id, user.id]);
  const done = () => goBack("/provider/parts/products");
  if (isNew) return <ProductForm isNew title={t("Add part", "إضافة قطعة")} initial={blankProduct} onSubmit={(i) => partsShopService.addProduct(asActor(user), i)} onDone={done} />;
  const p = state.data;
  if (!p) return (
    <Page title={t("Edit part", "تعديل القطعة")}>
      {state.error ? <Note tone="danger" icon="alert-circle-outline">{state.error}</Note> : <SkeletonRows count={5} />}
    </Page>
  );
  return (
    <ProductForm isNew={false} product={p} title={t("Edit part", "تعديل القطعة")} line={p.name}
      actions={typesForCategory(p.category).length ? [{ key: "3d", label: t("Show it in 3D on customers' cars", "اعرضها ثلاثية الأبعاد على سيارات العملاء"), icon: "cube-outline", run: () => router.push(`/provider/parts/accessory-3d/${id}`) }] : undefined}
      onSubmit={(i) => partsShopService.updateProduct(asActor(user), id, i)} onDone={done}
      initial={{ name: p.name, brand: p.brand, partNumber: p.partNumber, description: p.description, price: p.price, stock: p.stock, category: p.category, condition: p.condition, partType: p.partType, imageUri: p.imageUri, fitments: p.fitments, isUniversal: p.isUniversal }} />
  );
}
