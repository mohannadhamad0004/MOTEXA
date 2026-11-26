// One product = Detail (docs/guide/10-ui-system.md): photo, facts, fitment; ONE primary (Edit product) in the footer; 3D request,
// 3D preview and the customer preview in ⋮.
import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { View } from "react-native";
import { GButton, GText, Note, StatusChip } from "../../../components/garage";
import type { ItemAction } from "../../../components/ItemActionsMenu";
import { Block, Facts, Loaded, Page } from "../../../components/manage/Page";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { asActor, useSessionUser } from "../../../core/session/session";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";
import { typesForCategory } from "../../accessory3d/api";
import { partsShopService } from "../partsService";

const go = (p: string) => router.push(p as Href);

export default function ProductDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const { g, align } = useGarageTheme();
  const state = useLoad(() => partsShopService.getMyProduct(asActor(user), id), [id, user.id]);
  const p = state.data;
  const can3D = !!p && typesForCategory(p.category).length > 0;
  const actions: ItemAction[] = [
    ...(can3D ? [
      { key: "3d", label: t("Manage 3D submission", "إدارة الطلب ثلاثي الأبعاد"), icon: "cube-outline" as const, run: () => go(`/provider/parts/accessory-3d/${id}`) },
      { key: "3dpreview", label: t("Preview 3D / View on car", "معاينة ثلاثية الأبعاد / عرض على سيارة"), icon: "car-sport-outline" as const, run: () => go(`/provider/parts/3d/preview/${id}`) },
    ] : []),
    { key: "preview", label: t("Customer preview", "معاينة العميل"), icon: "eye-outline", run: () => go(`/provider/parts/preview?productId=${id}`) },
  ];
  const visible = p?.customerVisible ? { label: t("Visible to customers", "ظاهر للعملاء"), tone: "success" as const }
    : { label: p?.hidden ? t("Hidden by MOTEXA", "مخفي بواسطة موتكسا") : t("Not publicly visible", "غير ظاهر للعملاء"), tone: "warning" as const };
  return (
    <Page title={p?.name ?? t("Product", "المنتج")} line={p ? [p.brand, p.partNumber].filter(Boolean).join(" · ") : undefined} actions={p ? actions : undefined}
      onRefresh={() => void state.reload()} refreshing={false}
      footer={p ? <GButton icon="create-outline" label={t("Edit product", "تعديل المنتج")} onPress={() => go(`/provider/parts/products/edit/${id}`)} /> : undefined}>
      <Loaded state={state}>{(p) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip label={visible.label} tone={visible.tone} /></View>
          {p.hiddenReason ? <Note tone="danger" icon="eye-off-outline">{p.hiddenReason}</Note> : null}
          {p.imageUri ? <Image source={{ uri: p.imageUri }} style={{ width: "100%", height: 210, borderRadius: gShape.small, backgroundColor: g.cardSoft }} contentFit="contain" accessibilityLabel={p.name} /> : null}
          <Block title={t("Details", "التفاصيل")}>
            <Facts rows={[
              [t("Price", "السعر"), formatPrice(p.price)],
              [t("Stock", "المخزون"), String(p.stock)],
              [t("Reserved", "المحجوز"), String(p.reservedStock ?? 0)],
              [t("Brand", "العلامة"), p.brand],
              [t("Part number", "رقم القطعة"), p.partNumber],
            ]} />
          </Block>
          {p.description ? <Block title={t("Description", "الوصف")}><GText style={[gType.bodySm, align, { paddingVertical: 10 }]}>{p.description}</GText></Block> : null}
          <Block title={t("Fits", "التوافق")}>
            <Facts rows={p.isUniversal ? [[t("Cars", "السيارات"), t("Universal: every car", "عام لجميع المركبات")]] : p.fitments.length
              ? p.fitments.map((f) => [`${f.make} ${f.model}`, `${f.yearFrom}–${f.yearTo}${f.trim ? ` · ${f.trim}` : ""}`] as [string, string])
              : [[t("Cars", "السيارات"), t("No car listed yet", "لا توجد سيارة بعد")]]} />
          </Block>
          {!typesForCategory(p.category).length ? <GText soft style={[gType.caption, align]}>{t("3D preview isn't available for this kind of part yet.", "المعاينة ثلاثية الأبعاد غير متاحة لهذا النوع من القطع بعد.")}</GText> : null}
        </>
      )}</Loaded>
    </Page>
  );
}
