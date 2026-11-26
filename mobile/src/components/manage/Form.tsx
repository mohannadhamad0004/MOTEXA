// Form pieces (docs/guide/10-ui-system.md §5). SmartPicker: a field that opens a searchable list (a sheet on phones, a panel under the
// field on wide screens) with suggestions on top. When the typed text matches no item exactly, the list ends with
// "+ Add '<text>' as a new <noun>": it asks only the extra fields it needs, creates the item and selects it. No separate Create buttons.
import { useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { Field, GButton, GIcon, GText, Note, SearchBar, Sheet, type GIconName } from "../garage";
import { useTwoPane } from "./ManagePage";

export type PickOption = { id: string; label: string; sub?: string; find?: string };
export type AddField = { key: string; label: string; numeric?: boolean; required?: boolean; initial?: (text: string) => string };
/** noun: [English noun, Arabic phrase with its adjective, e.g. "شركة جديدة"] */
export type PickerAdd = { noun: [string, string]; fields?: AddField[]; create: (text: string, values: Record<string, string>) => Promise<string> };

const norm = (s: string) => s.toLocaleLowerCase().trim();

export function SmartPicker({ label, value, options, suggested = [], onChange, placeholder, disabled, add, hint }: {
  label: string; value: string | null | undefined; options: PickOption[];
  /** ids shown first (from the source's title / tags) */
  suggested?: string[];
  onChange: (id: string) => void; placeholder?: string; disabled?: boolean; add?: PickerAdd;
  /** one short line under the field (e.g. "Suggested from the Sketchfab title") */
  hint?: string;
}) {
  const { t } = useL();
  const { g, row, align, isArabic } = useGarageTheme();
  const wide = useTwoPane();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value) ?? null;
  const field = (
    <View style={{ gap: 6 }}>
      <GText style={[gType.label, align, { fontWeight: "700" }]}>{label}</GText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? t("choose", "اختر")}`} accessibilityState={{ disabled, expanded: open }} disabled={disabled} onPress={() => setOpen(o => !o)}
        style={({ pressed }) => [row, { minHeight: 52, alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: gShape.small, borderWidth: 1, borderColor: open ? g.accent : g.line, backgroundColor: pressed ? g.tint : g.card, opacity: disabled ? 0.5 : 1 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <GText numberOfLines={1} soft={!selected} style={[gType.body, align]}>{selected?.label ?? placeholder ?? t("Choose", "اختر")}</GText>
          {selected?.sub ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{selected.sub}</GText> : null}
        </View>
        <GIcon name={open ? "chevron-up" : "chevron-down"} size={18} color={g.soft} />
      </Pressable>
      {hint ? <GText soft style={[gType.caption, align]}>{hint}</GText> : null}
    </View>
  );
  const list = <PickList options={options} suggested={suggested} value={value} add={add} wide={wide} isArabic={isArabic}
    onPick={id => { setOpen(false); onChange(id); }} />;
  return (
    <View style={{ gap: 8 }}>
      {field}
      {open && wide ? <View style={{ borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: g.card, padding: 10, maxHeight: 420 }}>{list}</View> : null}
      {!wide ? <Sheet visible={open} onClose={() => setOpen(false)} tall title={label} closeLabel={t("Close", "إغلاق")}>{open ? list : null}</Sheet> : null}
    </View>
  );
}

function PickList({ options, suggested, value, add, onPick, wide, isArabic }: { options: PickOption[]; suggested: string[]; value: string | null | undefined; add?: PickerAdd; onPick: (id: string) => void; wide: boolean; isArabic: boolean }) {
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const [q, setQ] = useState(""), [adding, setAdding] = useState<string | null>(null);
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hit = (o: PickOption) => { const hay = norm(`${o.label} ${o.sub ?? ""} ${o.find ?? ""}`); return words.every(w => hay.includes(w)); };
  const top = q ? [] : suggested.map(id => options.find(o => o.id === id)).filter((o): o is PickOption => !!o);
  const rest = options.filter(o => hit(o) && !top.includes(o));
  const exact = options.some(o => norm(o.label) === norm(q));
  const offerAdd = !!add && !!q.trim() && !exact;
  const rowFor = (o: PickOption, sug: boolean) => (
    <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: o.id === value }} accessibilityLabel={[o.label, o.sub].filter(Boolean).join(", ")} onPress={() => onPick(o.id)}
      style={({ pressed }) => [row, { minHeight: 48, alignItems: "center", gap: 10, paddingHorizontal: 10, borderRadius: gShape.small, backgroundColor: o.id === value ? g.tint : pressed ? g.cardSoft : "transparent" }]}>
      {sug ? <GIcon name="sparkles-outline" size={16} color={g.accentText} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText numberOfLines={1} style={[gType.body, align, o.id === value ? { fontWeight: "800" } : null]}>{o.label}</GText>
        {o.sub ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{o.sub}</GText> : null}
      </View>
      {o.id === value ? <GIcon name="checkmark" size={18} color={g.accentText} /> : null}
    </Pressable>
  );
  if (adding !== null && add) return <AddForm text={adding} add={add} onDone={onPick} onCancel={() => setAdding(null)} />;
  const items = [...top.map(o => ({ o, sug: true })), ...rest.map(o => ({ o, sug: false }))];
  return (
    <View style={{ gap: 8, flexShrink: 1 }}>
      <SearchBar value={q} onChangeText={setQ} placeholder={t("Search or type a new name", "ابحث أو اكتب اسمًا جديدًا")} />
      <FlatList data={items} keyExtractor={x => x.o.id} renderItem={({ item }) => rowFor(item.o, item.sug)} keyboardShouldPersistTaps="handled"
        style={{ maxHeight: wide ? 300 : undefined }} initialNumToRender={20}
        ListEmptyComponent={!offerAdd ? <GText soft style={[gType.caption, align, { padding: 10 }]}>{t("Nothing matches.", "لا توجد نتائج مطابقة.")}</GText> : null}
        ListFooterComponent={offerAdd ? (
          <Pressable accessibilityRole="button" onPress={() => setAdding(q.trim())}
            style={({ pressed }) => [row, { minHeight: 48, alignItems: "center", gap: 10, paddingHorizontal: 10, marginTop: 4, borderRadius: gShape.small, borderWidth: 1, borderStyle: "dashed", borderColor: g.accent, backgroundColor: pressed ? g.tint : "transparent" }]}>
            <GIcon name="add" size={18} color={g.accentText} />
            <GText style={[gType.label, align, { flex: 1, color: g.accentText, fontWeight: "800" }]}>
              {isArabic ? `إضافة «${q.trim()}» ك${add!.noun[1]}` : `Add “${q.trim()}” as a new ${add!.noun[0]}`}
            </GText>
          </Pressable>
        ) : null} />
    </View>
  );
}

/** Only the fields the new item still needs; the typed text is its name. */
function AddForm({ text, add, onDone, onCancel }: { text: string; add: PickerAdd; onDone: (id: string) => void; onCancel: () => void }) {
  const { t, isArabic } = useL();
  const { row, align } = useGarageTheme();
  const fields = add.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.key, f.initial?.(text) ?? ""])));
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { setError(null); }, [values]);
  const missing = fields.some(f => f.required && !values[f.key]?.trim());
  const save = async () => {
    setBusy(true); setError(null);
    try { onDone(await add.create(text, values)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 10 }}>
      <GText style={[gType.label, align, { fontWeight: "800" }]}>{isArabic ? `${add.noun[1]}: ${text}` : `New ${add.noun[0]}: ${text}`}</GText>
      {fields.map(f => <Field key={f.key} label={f.label} value={values[f.key] ?? ""} keyboardType={f.numeric ? "number-pad" : undefined}
        onChangeText={v => setValues(s => ({ ...s, [f.key]: v }))} />)}
      {error ? <Note tone="danger">{error}</Note> : null}
      <View style={[row, { gap: 10 }]}>
        <GButton flex variant="secondary" label={t("Back", "رجوع")} disabled={busy} onPress={onCancel} />
        <GButton flex label={t("Add", "إضافة")} busy={busy} disabled={busy || missing} onPress={() => void save()} />
      </View>
    </View>
  );
}

/** A sheet that asks for a required reason before a decision someone else will read (reject, request changes). */
export function ReasonSheet({ visible, title, prompt, confirmLabel, busy, danger, onCancel, onConfirm }: {
  visible: boolean; title: string; prompt: string; confirmLabel: string; busy?: boolean; danger?: boolean; onCancel: () => void; onConfirm: (reason: string) => void;
}) {
  const { t } = useL();
  const { row } = useGarageTheme();
  const [reason, setReason] = useState("");
  useEffect(() => { if (visible) setReason(""); }, [visible]);
  return (
    <Sheet visible={visible} onClose={onCancel} title={title} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 12 }}>
        <Field label={prompt} value={reason} onChangeText={setReason} multiline maxLength={1000} />
        <View style={[row, { gap: 10 }]}>
          <GButton flex variant="secondary" label={t("Cancel", "إلغاء")} disabled={busy} onPress={onCancel} />
          <GButton flex variant={danger ? "danger" : "primary"} label={confirmLabel} busy={busy} disabled={busy || !reason.trim()} onPress={() => onConfirm(reason.trim())} />
        </View>
      </View>
    </Sheet>
  );
}

/** The sticky footer of a Form / step flow: an optional Back (ghost) and the page's ONE primary action. */
export function StepFooter({ back, primary }: { back?: { label: string; onPress: () => void }; primary: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; icon?: GIconName } }) {
  const { row } = useGarageTheme();
  return (
    <View style={[row, { gap: 10 }]}>
      {back ? <GButton flex variant="ghost" label={back.label} onPress={back.onPress} /> : null}
      <GButton flex icon={primary.icon} label={primary.label} busy={primary.busy} disabled={primary.disabled || primary.busy} onPress={primary.onPress} />
    </View>
  );
}

/** "Discard changes?" when a Form with unsaved changes is left (← back, Android back, a crumb). Render `sheet`; call `release()`
 *  right before leaving on purpose (after a save). */
export function useDiscardGuard(dirty: boolean) {
  const nav = useNavigation();
  const { t } = useL();
  const { row, align } = useGarageTheme();
  const [pending, setPending] = useState<object | null>(null);
  const live = useRef(dirty);
  live.current = dirty;
  const released = useRef(false);
  useEffect(() => nav.addListener("beforeRemove" as never, (e: { preventDefault: () => void; data: { action: object } }) => {
    if (!live.current || released.current) return;
    e.preventDefault();
    setPending(e.data.action);
  }), [nav]);
  const sheet = (
    <Sheet visible={!!pending} onClose={() => setPending(null)} title={t("Discard changes?", "تجاهل التغييرات؟")} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 12 }}>
        <GText soft style={[gType.bodySm, align]}>{t("Your changes are not saved yet.", "لم تُحفظ تغييراتك بعد.")}</GText>
        <View style={[row, { gap: 10 }]}>
          <GButton flex variant="secondary" label={t("Keep editing", "متابعة التعديل")} onPress={() => setPending(null)} />
          <GButton flex variant="danger" label={t("Discard", "تجاهل")} onPress={() => { const a = pending; setPending(null); released.current = true; if (a) nav.dispatch(a as never); }} />
        </View>
      </View>
    </Sheet>
  );
  return { sheet, release: () => { released.current = true; } };
}
