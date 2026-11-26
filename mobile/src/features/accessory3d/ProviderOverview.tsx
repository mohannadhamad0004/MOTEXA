// The shop's 3D parts (or only those with a 3D request: `submissions`) = List: search, compact rows (product, its 3D pieces and where
// they are), what failed or waits for changes first, ⋮ per row; tap opens the product's 3D request. Pages add up while scrolling.
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ManagePage, ManageRow } from "../../components/manage/ManagePage";
import type { Tone } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { portalApi } from "../provider/portal/api";
import type { Provider3dProduct } from "../provider/portal/types";
import { shop3dActions } from "../parts/provider/shopActions";
import { ACCESSORY_TYPE_LABELS, STATUS_LABELS } from "./api";

type T = (en: string, ar: string) => string;
type Part = Provider3dProduct["parts"][number];
const partState = (p: Part, t: T): { label: string; tone: Tone; rank: number } =>
  p.lifecycleState === "FAILED" ? { label: t("Generation failed", "تعذّر الإنشاء"), tone: "danger", rank: 0 }
  : p.status === "REJECTED" ? { label: t(...STATUS_LABELS[p.status]), tone: "warning", rank: 1 }
  : p.lifecycleState === "UNPUBLISHED" ? { label: t("Unpublished", "غير منشور"), tone: "neutral", rank: 2 }
  : p.lifecycleState === "GENERATION_QUEUED" ? { label: t("Generation queued", "الإنشاء في قائمة الانتظار"), tone: "accent", rank: 3 }
  : { label: t(...STATUS_LABELS[p.status]), tone: p.status === "PUBLISHED" ? "success" : "accent", rank: p.status === "PUBLISHED" ? 5 : 4 };

export default function ProviderOverview({ submissions = false }: { submissions?: boolean }) {
  const { t, isArabic } = useL();
  const [page, setPage] = useState(1), [q, setQ] = useState("");
  const [items, setItems] = useState<Provider3dProduct[]>([]);
  const state = useLoad(() => portalApi.products3d(page, q, submissions), [page, q, submissions]);
  useEffect(() => { if (state.data) setItems((prev) => (page === 1 ? state.data!.products : [...prev, ...state.data!.products.filter((p) => !prev.some((x) => x.id === p.id))])); }, [state.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = (p: Provider3dProduct) => p.parts.map((x) => partState(x, t)).sort((a, b) => a.rank - b.rank)[0] ?? null;
  const rows = [...items].sort((a, b) => (top(a)?.rank ?? 9) - (top(b)?.rank ?? 9));
  const reload = () => { setPage(1); void state.reload(); };
  return (
    <ManagePage title={submissions ? t("3D submissions", "طلبات ثلاثية الأبعاد") : t("3D parts", "قطع ثلاثية الأبعاد")}
      line={state.data ? t(`${state.data.total} products`, `${state.data.total} منتجات`) : undefined}
      search={{ value: q, onChange: (v) => { setQ(v); setPage(1); }, placeholder: t("Search products", "ابحث عن منتج") }}
      items={rows} keyOf={(p) => p.id}
      renderItem={(p) => {
        const s = top(p);
        const gens = new Set(p.parts.flatMap((x) => x.generations.map((g) => (isArabic ? g.nameAr : g.name)))).size;
        return <ManageRow title={p.name} status={s ? { label: s.label, tone: s.tone } : { label: t("No 3D model", "لا يوجد نموذج"), tone: "neutral" }}
          sub={[p.parts.map((x) => t(...ACCESSORY_TYPE_LABELS[x.type])).join(", "), gens ? t(`${gens} cars`, `${gens} سيارات`) : null, p.parts.find((x) => x.reviewNotes)?.reviewNotes].filter(Boolean).join(" · ")}
          onPress={() => router.push(`/provider/parts/accessory-3d/${p.id}` as Href)} actions={shop3dActions(t, p, (type) => t(...ACCESSORY_TYPE_LABELS[type]), reload)} />;
      }}
      loading={!state.data && !state.error && !items.length} error={state.error} onRetry={reload}
      empty={{ text: q ? t("No product matches.", "لا يوجد منتج مطابق.") : t("No 3D products yet. Add a bumper, a rear wing or rims to begin.", "لا توجد منتجات ثلاثية الأبعاد بعد. أضف مصدًا أو جناحًا خلفيًا أو جنوطًا للبدء.") }}
      onEndReached={() => { if (state.data?.hasMore && !state.loading) setPage((v) => v + 1); }} loadingMore={state.loading && page > 1}
      onRefresh={reload} refreshing={false} detailHint={t("Tap a product to open its 3D request.", "اضغط على منتج لفتح طلبه ثلاثي الأبعاد.")} />
  );
}
