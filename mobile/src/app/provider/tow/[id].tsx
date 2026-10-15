import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { HistoryList, KV, PrivateDocs, VerificationBadge } from "../../../features/shared/blocks";
import { C } from "../../../features/shared/palette";
import { asActor, useSessionUser } from "../../../features/shared/session";
import {
  Async, Button, Card, Field, Header, Notice, Screen, Section, Thumb, goBack, pickImage, useL, useLoad,
} from "../../../features/shared/ui";
import { DocKind, TRUCK_TYPES, Truck, TruckInput, TruckType, towFleetService } from "../../../features/tow/towService";
import { OperationalBadge, TruckSummary, docLabel, useTruckLabels } from "../../../features/tow/truckBits";
import { isRealDate } from "../../../features/shared/files";

const KINDS: DocKind[] = ["REGISTRATION", "INSURANCE"];

function TruckForm({ truck, onSaved, onCancel }: { truck?: Truck; onSaved: () => void; onCancel?: () => void }) {
  const user = useSessionUser();
  const { t, row } = useL();
  const { type } = useTruckLabels();
  const [f, setF] = useState<TruckInput>(
    truck ?? { type: "FLATBED", plate: "", make: "", model: "", year: null, photoUri: null, documents: [] }
  );
  const [year, setYear] = useState(f.year ? String(f.year) : "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasDoc = (k: DocKind) => f.documents.some((d) => d.kind === k);
  const attach = async (k: DocKind) => {
    const uri = await pickImage();
    if (!uri) return;
    const name = uri.split("/").pop() || `${k.toLowerCase()}.jpg`;
    const prev = f.documents.find((d) => d.kind === k);
    setF({ ...f, documents: [...f.documents.filter((d) => d.kind !== k), { kind: k, fileName: name, uri, expiresAt: prev?.expiresAt ?? null }] });
  };
  const expiryOf = (k: DocKind) => (f.documents.find((d) => d.kind === k)?.expiresAt ?? "").slice(0, 10);
  const setExpiry = (k: DocKind, v: string) =>
    setF({ ...f, documents: f.documents.map((d) => (d.kind === k ? { ...d, expiresAt: v } : d)) });

  const save = async () => {
    if (!f.plate.trim() || !f.make.trim() || !f.model.trim()) return setErr(t("Plate, make and model are required.", "اللوحة والشركة والطراز مطلوبة."));
    if (!f.photoUri) return setErr(t("A truck photo is required.", "صورة الشاحنة مطلوبة."));
    if (!KINDS.every(hasDoc)) return setErr(t("Attach the registration and insurance documents.", "أرفق ترخيص المركبة والتأمين."));
    if (KINDS.some((k) => expiryOf(k) && !isRealDate(expiryOf(k))))
      return setErr(t("Expiry date must be a real date in YYYY-MM-DD format.", "يجب أن يكون تاريخ الانتهاء تاريخًا حقيقيًا بصيغة YYYY-MM-DD."));
    setBusy(true);
    setErr(null);
    try {
      const input = { ...f, year: year ? parseInt(year, 10) : null };
      if (truck) await towFleetService.updateTruck(asActor(user), truck.id, input);
      else await towFleetService.addTruck(asActor(user), input);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!truck && (
        <Notice icon="time-outline">
          {t("New trucks start as Pending and need MOTEXA approval before they can be used.", "تبدأ الشاحنات الجديدة بحالة قيد المراجعة وتحتاج لاعتماد MOTEXA قبل استخدامها.")}
        </Notice>
      )}
      {truck && truck.verification === "APPROVED" && (
        <Notice icon="information-circle-outline">
          {t("Changing the plate, type or documents may require MOTEXA to review this truck again.", "قد يتطلب تغيير اللوحة أو النوع أو المستندات مراجعة الشاحنة من MOTEXA مرة أخرى.")}
        </Notice>
      )}
      <Card>
        <View style={[row, { alignItems: "center", gap: 14, marginBottom: 14 }]}>
          <Thumb uri={f.photoUri} icon="camera-outline" size={72} />
          <View style={{ flex: 1 }}>
            <Button
              variant="ghost"
              icon="camera-outline"
              label={f.photoUri ? t("Change photo", "تغيير الصورة") : t("Add truck photo", "إضافة صورة الشاحنة")}
              onPress={async () => {
                const uri = await pickImage();
                if (uri) setF({ ...f, photoUri: uri });
              }}
            />
          </View>
        </View>
        <Text style={{ color: "#E8D8CC", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 7 }}>
          {t("TRUCK TYPE", "نوع الشاحنة")}
        </Text>
        <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 14 }]}>
          {TRUCK_TYPES.map((k: TruckType) => (
            <View key={k}>
              <Button
                variant={f.type === k ? "primary" : "ghost"}
                label={type[k]}
                onPress={() => setF({ ...f, type: k })}
              />
            </View>
          ))}
        </View>
        <Field label={t("Plate number", "رقم اللوحة")} value={f.plate} autoCapitalize="characters" onChangeText={(v) => setF({ ...f, plate: v })} />
        <Field label={t("Make", "الشركة المصنعة")} value={f.make} onChangeText={(v) => setF({ ...f, make: v })} />
        <Field label={t("Model", "الطراز")} value={f.model} onChangeText={(v) => setF({ ...f, model: v })} />
        <Field label={t("Year", "السنة")} value={year} keyboardType="number-pad" onChangeText={setYear} />
      </Card>

      <Section title={t("Required documents", "المستندات المطلوبة")} />
      <Card>
        {KINDS.map((k) => (
          <View key={k} style={{ marginBottom: 10 }}>
            <Button
              variant="ghost"
              icon={hasDoc(k) ? "checkmark-circle-outline" : "attach-outline"}
              label={`${docLabel(t, k)} — ${hasDoc(k) ? t("attached", "مرفق") : t("attach", "إرفاق")}`}
              onPress={() => attach(k)}
            />
            {hasDoc(k) && (
              <Field
                label={t("Expiry date (YYYY-MM-DD, optional)", "تاريخ الانتهاء (YYYY-MM-DD، اختياري)")}
                value={expiryOf(k)}
                placeholder="2027-12-31"
                keyboardType="numbers-and-punctuation"
                onChangeText={(v) => setExpiry(k, v)}
              />
            )}
          </View>
        ))}
        <Text style={{ color: C.textDim, fontSize: 11 }}>
          {t("Private: visible only to MOTEXA admins and you.", "خاصة: تظهر فقط لمسؤولي MOTEXA ولك.")}
        </Text>
      </Card>

      <View style={{ height: 16 }} />
      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      <View style={{ gap: 8 }}>
        <Button label={truck ? t("Save changes", "حفظ التغييرات") : t("Submit for approval", "إرسال للاعتماد")} disabled={busy} onPress={save} />
        {onCancel && <Button variant="ghost" label={t("Cancel", "إلغاء")} onPress={onCancel} />}
      </View>
    </>
  );
}

function TruckView({ truck, onChange }: { truck: Truck; onChange: () => void }) {
  const user = useSessionUser();
  const { t } = useL();
  const { type } = useTruckLabels();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (editing) return <TruckForm truck={truck} onSaved={() => { setEditing(false); onChange(); }} onCancel={() => setEditing(false)} />;

  const remove = async () => {
    try {
      await towFleetService.removeTruck(asActor(user), truck.id);
      goBack("/provider/tow");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <>
      <Card>
        <TruckSummary truck={truck} />
      </Card>

      <Section title={t("Vehicle", "المركبة")} />
      <Card>
        <KV k={t("Type", "النوع")} v={type[truck.type]} />
        <KV k={t("Plate", "اللوحة")} v={truck.plate} />
        <KV k={t("Make / model", "الشركة / الطراز")} v={`${truck.make} ${truck.model}`} />
        <KV k={t("Year", "السنة")} v={truck.year} />
      </Card>

      <Section title={t("Status", "الحالة")} />
      <Card>
        <View style={{ gap: 10, alignItems: "flex-start" }}>
          <VerificationBadge value={truck.verification} prefix={t("Approval", "الاعتماد")} />
          <OperationalBadge value={truck.operational} />
        </View>
        {truck.rejectionReason ? (
          <View style={{ marginTop: 12 }}>
            <Notice tone="danger" icon="close-circle-outline">{truck.rejectionReason}</Notice>
          </View>
        ) : null}
      </Card>

      <PrivateDocs
        title={t("Documents", "المستندات")}
        docs={truck.documents.map((d) => ({ label: docLabel(t, d.kind), fileName: d.fileName, expiresAt: d.expiresAt, uri: d.uri }))}
      />
      <Section title={t("History", "السجل")} />
      <HistoryList items={truck.history} />

      <View style={{ height: 20 }} />
      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      <View style={{ gap: 8 }}>
        <Button icon="create-outline" label={t("Edit truck", "تعديل الشاحنة")} onPress={() => setEditing(true)} />
        {truck.hasActiveJob && (
          <Notice icon="lock-closed-outline">
            {t("This truck is engaged in a service and cannot be removed until it finishes.", "هذه الشاحنة منشغلة بخدمة ولا يمكن إزالتها حتى تنتهي.")}
          </Notice>
        )}
        {!confirm ? (
          <Button variant="danger" icon="trash-outline" label={t("Remove truck", "إزالة الشاحنة")} disabled={truck.hasActiveJob} onPress={() => setConfirm(true)} />
        ) : (
          <>
            <Button variant="danger" label={t("Yes, remove this truck", "نعم، أزل هذه الشاحنة")} onPress={remove} />
            <Button variant="ghost" label={t("Cancel", "إلغاء")} onPress={() => setConfirm(false)} />
          </>
        )}
      </View>
    </>
  );
}

export default function TruckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSessionUser();
  const { t } = useL();
  const isNew = id === "new";
  const state = useLoad<Truck | null>(
    () => (isNew ? Promise.resolve(null) : towFleetService.getMyTruck(asActor(user), id)),
    [id, user.id]
  );

  return (
    <Screen>
      <Header brand="MOTEXA TOW" title={isNew ? t("Add truck", "إضافة شاحنة") : t("Truck", "الشاحنة")} back />
      {isNew ? (
        <TruckForm onSaved={() => goBack("/provider/tow")} />
      ) : (
        <Async state={state as { data: Truck | null; error: string | null; loading: boolean; reload: () => void }}>
          {(tr) => <TruckView truck={tr} onChange={state.reload} />}
        </Async>
      )}
    </Screen>
  );
}
