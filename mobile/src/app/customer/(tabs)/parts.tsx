import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ProductCard } from "../../../features/catalog/catalogBits";
import { CatalogProduct, catalogService, fitMemory } from "../../../features/catalog/catalogService";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { C } from "../../../features/shared/palette";
import { Button, Card, Empty, Field, Header, Notice, SearchBar, useL } from "../../../features/shared/ui";

export default function CustomerParts() {
  const { t, row } = useL();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? "");
  // "Fits my car" values live in memory for the app session, so they survive leaving this tab.
  const [make, setMake] = useState(fitMemory.make);
  const [model, setModel] = useState(fitMemory.model);
  const [year, setYear] = useState(fitMemory.year);
  const [showFit, setShowFit] = useState(!!(fitMemory.make || fitMemory.model || fitMemory.year));

  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0); // ignore answers of searches that were replaced by a newer one

  // A query coming from the Home search box.
  useEffect(() => {
    if (typeof params.q === "string") setQ(params.q);
  }, [params.q]);

  const yearOk = year.trim() === "" || /^\d{4}$/.test(year.trim());
  const modelOrYearWithoutMake = !make.trim() && (!!model.trim() || !!year.trim());
  const fitHint = modelOrYearWithoutMake
    ? t("Enter the make first.", "أدخل الشركة المصنعة أولًا.")
    : !yearOk
      ? t("The year must be 4 digits, e.g. 2016.", "يجب أن تتكون السنة من 4 أرقام، مثل 2016.")
      : null;
  const fitOn = !!make.trim() && yearOk;

  const run = useCallback(
    async (pageNo: number, mode: "replace" | "more" | "refresh") => {
      const mine = ++seq.current;
      if (mode === "more") setLoadingMore(true);
      else if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const r = await catalogService.searchParts({
          q,
          ...(fitOn ? { make, model, year: year.trim() } : {}),
          page: pageNo,
        });
        if (mine !== seq.current) return;
        setItems((cur) => (mode === "more" ? [...cur, ...r.products] : r.products));
        setPage(r.page);
        setTotal(r.total);
        setHasMore(r.hasMore);
      } catch (e: any) {
        if (mine === seq.current) setError(e.message);
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [q, make, model, year, fitOn]
  );

  // Search as the user types, after a short pause.
  useEffect(() => {
    fitMemory.make = make;
    fitMemory.model = model;
    fitMemory.year = year;
    const h = setTimeout(() => run(1, "replace"), 350);
    return () => clearTimeout(h);
  }, [run, make, model, year]);

  const clearFit = () => {
    setMake("");
    setModel("");
    setYear("");
  };

  return (
    <CustomerScreen tabs refreshing={refreshing} onRefresh={() => run(1, "refresh")}>
      <Header brand="MOTEXA" title={t("Parts", "قطع الغيار")} subtitle={t("Find the right part for your car", "اعثر على القطعة المناسبة لسيارتك")} />
      <SearchBar value={q} onChange={setQ} placeholder={t("Name, brand or part number", "الاسم أو الماركة أو رقم القطعة")} />

      <View style={{ marginBottom: 14 }}>
        <Button
          variant={fitOn ? "primary" : "ghost"}
          icon="car-outline"
          label={fitOn ? `${t("Fits my car", "تناسب سيارتي")}: ${make.trim()}${model.trim() ? " " + model.trim() : ""}${year.trim() ? " " + year.trim() : ""}` : t("Fits my car", "تناسب سيارتي")}
          onPress={() => setShowFit(!showFit)}
        />
      </View>
      {showFit && (
        <Card>
          <Field label={t("Make", "الشركة المصنعة")} value={make} onChangeText={setMake} placeholder="Toyota" autoCapitalize="words" />
          <Field label={t("Model", "الطراز")} value={model} onChangeText={setModel} placeholder="Corolla" autoCapitalize="words" />
          <Field label={t("Year", "السنة")} value={year} onChangeText={setYear} placeholder="2016" keyboardType="number-pad" maxLength={4} />
          {fitHint ? <Notice tone="accent" icon="information-circle-outline">{fitHint}</Notice> : null}
          <Button variant="ghost" icon="close-circle-outline" label={t("Clear", "مسح")} onPress={clearFit} disabled={!make && !model && !year} />
        </Card>
      )}

      {loading && !items.length ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={C.accent} />
      ) : error && !items.length ? (
        <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
          <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
          <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" icon="refresh-outline" onPress={() => run(1, "replace")} />
        </View>
      ) : !items.length ? (
        <Empty icon="cube-outline" text={fitOn || q.trim() ? t("No parts match your search.", "لا توجد قطع مطابقة لبحثك.") : t("No parts are available yet.", "لا توجد قطع متاحة بعد.")} />
      ) : (
        <>
          <View style={[row, { marginBottom: 10 }]}>
            <Notice icon="cube-outline">{`${total} ${total === 1 ? t("part", "قطعة") : t("parts", "قطع")}`}</Notice>
          </View>
          {error ? <Notice tone="danger" icon="alert-circle-outline">{error}</Notice> : null}
          {items.map((p) => (
            <ProductCard key={p.id} p={p} onPress={() => router.push(`/customer/parts/${p.id}`)} />
          ))}
          {hasMore && (
            <Button label={loadingMore ? t("Loading…", "جارٍ التحميل…") : t("Load more", "تحميل المزيد")} variant="ghost" icon="chevron-down-outline" disabled={loadingMore} onPress={() => run(page + 1, "more")} />
          )}
        </>
      )}
    </CustomerScreen>
  );
}
