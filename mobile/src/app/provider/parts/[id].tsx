import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Fitment, Product, ProductInput, partsShopService } from "../../../features/parts/partsService";
import { asActor, useSessionUser } from "../../../features/shared/session";
import {
  Async, Button, Card, Field, Header, Notice, Screen, Section, Thumb, goBack, pickImage, useL, useLoad,
} from "../../../features/shared/ui";

const blank: ProductInput = {
  name: "", brand: "", partNumber: "", description: "", price: 0, stock: 0, imageUri: null, fitments: [],
};

function Form({ initial, product, id }: { initial: ProductInput; product?: Product; id: string }) {
  const user = useSessionUser();
  const { t, row } = useL();
  const [f, setF] = useState(initial);
  const [price, setPrice] = useState(String(initial.price || ""));
  const [stock, setStock] = useState(String(initial.stock || ""));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isNew = id === "new";

  const setFit = (i: number, patch: Partial<Fitment>) =>
    setF({ ...f, fitments: f.fitments.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input: ProductInput = {
        ...f,
        price: parseFloat(price || "0"),
        stock: parseInt(stock || "0", 10),
        fitments: f.fitments.filter((x) => x.make.trim() && x.model.trim()),
      };
      if (isNew) await partsShopService.addProduct(asActor(user), input);
      else await partsShopService.updateProduct(asActor(user), id, input);
      goBack("/provider/parts");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {product?.hidden && (
        <Notice tone="danger" icon="eye-off-outline">
          {t("Hidden by MOTEXA", "مخفية بواسطة MOTEXA")}
          {product.hiddenReason ? "\n" + product.hiddenReason : ""}
          {"\n"}
          {t("You can edit the details, but only MOTEXA can make this listing visible again.", "يمكنك تعديل التفاصيل، ولكن MOTEXA فقط يمكنها إعادة إظهار هذه القطعة.")}
        </Notice>
      )}
      <Card>
        <View style={[row, { alignItems: "center", gap: 14, marginBottom: 14 }]}>
          <Thumb uri={f.imageUri} icon="image-outline" size={72} />
          <View style={{ flex: 1 }}>
            <Button
              variant="ghost"
              icon="camera-outline"
              label={f.imageUri ? t("Change image", "تغيير الصورة") : t("Add image", "إضافة صورة")}
              onPress={async () => {
                const uri = await pickImage();
                if (uri) setF({ ...f, imageUri: uri });
              }}
            />
          </View>
        </View>
        <Field label={t("Part name", "اسم القطعة")} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Field label={t("Brand", "العلامة التجارية")} value={f.brand} onChangeText={(v) => setF({ ...f, brand: v })} />
        <Field label={t("Part number", "رقم القطعة")} value={f.partNumber} autoCapitalize="characters" onChangeText={(v) => setF({ ...f, partNumber: v })} />
        <Field label={t("Description", "الوصف")} value={f.description} multiline onChangeText={(v) => setF({ ...f, description: v })} />
        <Field label={t("Price", "السعر")} value={price} keyboardType="decimal-pad" onChangeText={setPrice} />
        <Field label={t("Stock quantity", "الكمية المتوفرة")} value={stock} keyboardType="number-pad" onChangeText={setStock} />
      </Card>

      <Section title={t("Vehicle fitment", "توافق المركبات")} />
      {f.fitments.map((x, i) => (
        <Card key={i}>
          <Field label={t("Make", "الشركة المصنعة")} value={x.make} onChangeText={(v) => setFit(i, { make: v })} />
          <Field label={t("Model", "الطراز")} value={x.model} onChangeText={(v) => setFit(i, { model: v })} />
          <View style={[row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Field label={t("Year from", "من سنة")} value={String(x.yearFrom || "")} keyboardType="number-pad" onChangeText={(v) => setFit(i, { yearFrom: parseInt(v || "0", 10) })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("Year to", "إلى سنة")} value={String(x.yearTo || "")} keyboardType="number-pad" onChangeText={(v) => setFit(i, { yearTo: parseInt(v || "0", 10) })} />
            </View>
          </View>
          <Field label={t("Engine / trim (optional)", "المحرك / الفئة (اختياري)")} value={x.trim ?? ""} onChangeText={(v) => setFit(i, { trim: v })} />
          <Button variant="danger" label={t("Remove fitment", "إزالة التوافق")} onPress={() => setF({ ...f, fitments: f.fitments.filter((_, j) => j !== i) })} />
        </Card>
      ))}
      <Button
        variant="ghost"
        icon="add-outline"
        label={t("Add fitment", "إضافة توافق")}
        onPress={() => setF({ ...f, fitments: [...f.fitments, { make: "", model: "", yearFrom: 2010, yearTo: 2020 }] })}
      />

      <View style={{ height: 20 }} />
      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      <Button label={isNew ? t("Add part", "إضافة القطعة") : t("Save changes", "حفظ التغييرات")} disabled={busy} onPress={save} />
    </>
  );
}

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
    <Screen>
      <Header brand="MOTEXA PARTS" title={isNew ? t("Add part", "إضافة قطعة") : t("Edit part", "تعديل القطعة")} back />
      {isNew ? (
        <Form initial={blank} id="new" />
      ) : (
        <Async state={state as { data: Product | null; error: string | null; loading: boolean; reload: () => void }}>
          {(p) => (
            <Form
              id={id}
              product={p}
              initial={{
                name: p.name, brand: p.brand, partNumber: p.partNumber, description: p.description,
                price: p.price, stock: p.stock, imageUri: p.imageUri, fitments: p.fitments,
              }}
            />
          )}
        </Async>
      )}
    </Screen>
  );
}
