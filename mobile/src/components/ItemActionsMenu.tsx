// ONE shared "⋮" action menu for list rows (like the chat menu in Claude): a 44 px "⋮" button on the row and a long-press on the row both open
// a bottom sheet with that item's actions (only the ones valid for its CURRENT state). Tapping the row itself still opens the item.
//   <ItemRow title="…" onPress={open} actions={[…]}>row content</ItemRow>      the row (card) with the "⋮" at its end
//   <ItemActionsMenu title="…" actions={[…]} />                               just the "⋮" button + sheet (rows that are not an ItemRow)
// Destructive actions (red) always ask first in a confirmation step inside the same sheet; every action that changes data ends in a toast.
// Colours come from the shared garage tokens (light / dark), layout is RTL-aware.
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { Card, GButton, GIcon, GText, Sheet, Tap } from "./garage";
import type { GIconName } from "./garage";
import { useL } from "../core/hooks/useL";
import { hapticError, hapticSuccess } from "../motion";
import { gShape, gType, useGarageTheme } from "../theme/garage";

export type ItemAction = {
  key: string;
  /** already translated */
  label: string;
  icon?: GIconName;
  /** red; always asks for confirmation first */
  destructive?: boolean;
  disabled?: boolean;
  /** why it is disabled (shown under the label) */
  hint?: string;
  /** the action: navigation returns nothing, a request returns its promise (the sheet shows progress, then a toast) */
  run: (reason?: string) => Promise<unknown> | void;
  /** ask first (destructive actions get a default confirmation when this is left out) */
  confirm?: { title?: string; message?: string | (() => Promise<string>); confirmLabel?: string; reason?: { label: string; required?: boolean } };
  /** toast after a successful request (none for navigation) */
  success?: string;
  /** error text for a failed request (default: the error's message) */
  error?: (e: unknown) => string;
};

// ---- toast (module-level, so it outlives a deleted row; the first mounted <ToastHost/> shows it) ----
type ToastTone = "ok" | "bad";
let toast: { id: number; text: string; tone: ToastTone } | null = null, toastTimer: ReturnType<typeof setTimeout> | null = null, toastN = 0;
const subs = new Set<() => void>(), hosts: symbol[] = [];
const notify = () => subs.forEach((f) => f());
export function showToast(text: string, tone: ToastTone = "ok") {
  toast = { id: ++toastN, text, tone };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast = null; notify(); }, tone === "bad" ? 6000 : 3200);
  notify();
}
export function ToastHost() {
  const { g, row, align } = useGarageTheme();
  // the toast lives in state (a module variable read during render is cached by the React Compiler: 2nd toast showed the 1st text)
  const [cur, setCur] = useState(toast), [me] = useState(() => Symbol("toast-host")), [first, setFirst] = useState(false);
  useEffect(() => {
    hosts.push(me); const f = () => { setCur(toast); setFirst(hosts[0] === me); }; subs.add(f); notify();
    return () => { hosts.splice(hosts.indexOf(me), 1); subs.delete(f); notify(); };
  }, [me]);
  if (!cur || !first) return null;
  const bad = cur.tone === "bad";
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 92, alignItems: "center", zIndex: 50 }}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[row, { maxWidth: 520, alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: gShape.small, backgroundColor: g.card, borderWidth: 1, borderColor: bad ? g.danger : g.success, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }]}>
        <GIcon name={bad ? "alert-circle" : "checkmark-circle"} size={20} color={bad ? g.danger : g.success} />
        <GText style={[gType.label, align, { flexShrink: 1, color: g.ink }]}>{cur.text}</GText>
      </View>
    </View>
  );
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : typeof e === "string" && e ? e : fallback);

/** The sheet: the item's actions, then (when needed) the confirmation step. */
export function ActionsSheet({ visible, onClose, title, subtitle, actions }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; actions: ItemAction[] }) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const [pending, setPending] = useState<ItemAction | null>(null), [busy, setBusy] = useState(false), [reason, setReason] = useState(""), [message, setMessage] = useState<string | null>(null), [loadingMsg, setLoadingMsg] = useState(false);
  useEffect(() => { if (!visible) { setPending(null); setReason(""); setMessage(null); setBusy(false); } }, [visible]);

  const execute = async (a: ItemAction, why?: string) => {
    setBusy(true);
    if (toast) { toast = null; notify(); } // never leave the previous action's toast on screen while this one runs
    try {
      const out = a.run(why?.trim() || undefined);
      if (out && typeof (out as Promise<unknown>).then === "function") { await out; hapticSuccess(); if (a.success) showToast(a.success, "ok"); }
      onClose();
    } catch (e) {
      hapticError(); onClose(); showToast(a.error ? a.error(e) : errorText(e, t("That did not work. Try again.", "لم تنجح العملية. حاول مجددًا.")), "bad");
    } finally { setBusy(false); }
  };
  const choose = (a: ItemAction) => {
    if (a.disabled || busy) return;
    const confirm = a.confirm ?? (a.destructive ? {} : null);
    if (!confirm) { void execute(a); return; }
    setPending(a); setReason(""); setMessage(null);
    if (typeof confirm.message === "function") { setLoadingMsg(true); confirm.message().then((m) => setMessage(m)).catch((e) => setMessage(errorText(e, ""))).finally(() => setLoadingMsg(false)); }
    else setMessage(confirm.message ?? null);
  };

  const c = pending ? (pending.confirm ?? {}) : null, needReason = !!c?.reason?.required && !reason.trim();
  return (
    <Sheet visible={visible} onClose={() => { if (!busy) onClose(); }} title={pending ? (c?.title ?? `${pending.label}?`) : title} closeLabel={t("Close", "إغلاق")}>
      {pending && c ? (
        <View style={{ gap: 12 }}>
          <GText soft style={[gType.caption, align]}>{title}</GText>
          {loadingMsg ? <ActivityIndicator color={g.accent} /> : message ? <GText style={[gType.body, align]}>{message}</GText> : null}
          {c.reason ? (
            <View style={{ gap: 6 }}>
              <GText style={[gType.label, align]}>{c.reason.label}</GText>
              <TextInput accessibilityLabel={c.reason.label} value={reason} onChangeText={setReason} multiline maxLength={500} placeholderTextColor={g.soft}
                style={{ color: g.ink, borderWidth: 1, borderColor: g.line, borderRadius: 12, padding: 12, minHeight: 84, textAlign: align.textAlign, backgroundColor: g.cardSoft, textAlignVertical: "top" }} />
            </View>
          ) : null}
          <GButton variant={pending.destructive ? "danger" : "primary"} label={c.confirmLabel ?? pending.label} busy={busy} disabled={busy || loadingMsg || needReason} onPress={() => void execute(pending, reason)} />
          <GButton variant="ghost" label={t("Cancel", "إلغاء")} disabled={busy} onPress={() => setPending(null)} />
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {subtitle ? <GText soft style={[gType.caption, align, { marginBottom: 4 }]}>{subtitle}</GText> : null}
          {actions.length === 0 ? <GText soft style={align}>{t("No actions available right now.", "لا توجد إجراءات متاحة الآن.")}</GText> : null}
          {actions.map((a) => {
            const tone = a.destructive ? g.danger : g.ink;
            return (
              <Tap key={a.key} label={a.label} disabled={a.disabled} onPress={() => choose(a)}
                style={[row, { minHeight: 52, alignItems: "center", gap: 14, paddingHorizontal: 14, borderRadius: gShape.small, backgroundColor: g.card, borderWidth: 1, borderColor: a.destructive ? g.danger + "55" : g.line, opacity: a.disabled ? 0.5 : 1 }]}>
                {a.icon ? <GIcon name={a.icon} size={22} color={tone} flip={isArabic && /arrow|chevron/.test(a.icon)} /> : <View style={{ width: 22 }} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <GText style={[gType.label, align, { color: tone, fontWeight: "700" }]}>{a.label}</GText>
                  {a.hint ? <GText soft style={[gType.tiny, align]}>{a.hint}</GText> : null}
                </View>
              </Tap>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

/** The "⋮" button: 44 px touch target, EN / AR accessibility label. */
export function DotsButton({ title, onPress, expanded, style }: { title: string; onPress: () => void; expanded?: boolean; style?: StyleProp<ViewStyle> }) {
  const { t } = useL();
  const { g } = useGarageTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t("More actions for", "المزيد من الإجراءات لـ")} ${title}`} accessibilityState={{ expanded: !!expanded }} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? g.tint : "transparent" }, style]}>
      <GIcon name="ellipsis-vertical" size={22} color={g.soft} />
    </Pressable>
  );
}

/** The "⋮" button + its sheet, for rows that are not an ItemRow. */
export function ItemActionsMenu({ title, subtitle, actions, style }: { title: string; subtitle?: string; actions: ItemAction[]; style?: StyleProp<ViewStyle> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DotsButton title={title} expanded={open} onPress={() => setOpen(true)} style={style} />
      <ActionsSheet visible={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle} actions={actions} />
    </>
  );
}

/** A list row (card): tap opens the item, long-press or the "⋮" at its end opens the actions sheet.
 *  style = the wrapper (margins); box = the card's own look when it is not the garage Card (department screens pass cardStyle()). */
export function ItemRow({ title, subtitle, actions, onPress, children, style, box }: { title: string; subtitle?: string; actions: ItemAction[]; onPress?: () => void; children: ReactNode; style?: StyleProp<ViewStyle>; box?: StyleProp<ViewStyle> }) {
  const { t, isArabic } = useL();
  const [open, setOpen] = useState(false);
  const body = (
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={title} accessibilityHint={t("Press and hold for actions", "اضغط مطولًا لعرض الإجراءات")} onPress={onPress} onLongPress={() => setOpen(true)} delayLongPress={380}
      style={({ pressed }) => ({ gap: 6, paddingEnd: 40, opacity: pressed && onPress ? 0.9 : 1 })}>
      {children}
    </Pressable>
  );
  return (
    <View style={style}>
      {box ? <View style={box}>{body}</View> : <Card>{body}</Card>}
      <DotsButton title={title} expanded={open} onPress={() => setOpen(true)} style={{ position: "absolute", top: 6, [isArabic ? "left" : "right"]: 6 }} />
      <ToastHost />
      <ActionsSheet visible={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle} actions={actions} />
    </View>
  );
}
