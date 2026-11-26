// ONE layout for the admin / provider management screens (the bulk fits pattern). Each page shows one main task:
//   header (back, short title, one short line; optional ⋮)  ·  optional segmented tabs (max 3-4)  ·  filter bar (search + chip rails)
//   ·  a virtualized list of compact rows (ManageRow)  ·  a sticky bulk bar while something is selected  ·  empty / loading / error
//   ·  details in a sheet on phones and a side panel on wide screens (>= 900 px). No settings gear: settings live in Profile.
// Garage tokens (light / dark), RTL through `row` / `align`, 390 px without overflow.
import { useState, type ReactElement, type ReactNode } from "react";
import { FlatList, Pressable, RefreshControl, View, useWindowDimensions } from "react-native";
import { useL } from "../../core/hooks/useL";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { Card, Chip, EmptyState, ErrorState, GIcon, GText, Rail, SearchBar, Sheet, SkeletonRows, StatusChip, Tabs, type GIconName, type Tone } from "../garage";
import { ItemActionsMenu, type ItemAction } from "../ItemActionsMenu";
import type { Crumb } from "../../core/nav/crumbs";
import { ManageHeader, Page } from "./Page";
export { ManageHeader };

export const MANAGE_ROW_H = 64;
/** side panel instead of a sheet from this width */
export const MANAGE_WIDE = 900;
export const useTwoPane = () => useWindowDimensions().width >= MANAGE_WIDE;

type Tabbed = { value: string; options: { key: string; label: string; count?: number }[]; onChange: (k: string) => void };
export function ManagePage<T>(p: {
  title: string; line?: string; actions?: ItemAction[];
  /** false on tab roots; `tabBar` when the floating tab bar sits under the list; `trail` = extra crumbs (see Page) */
  back?: boolean; tabBar?: boolean; trail?: Crumb[];
  tabs?: Tabbed;
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  /** chip rails (Rail) under the search */
  filters?: ReactNode;
  /** between the filters and the list: a running job, a result note, an entry row to another view */
  above?: ReactNode;
  /** the list's head: select-all row, selection banner, column names */
  listHead?: ReactNode;
  items: T[]; keyOf: (item: T) => string; renderItem: (item: T) => ReactElement; rowHeight?: number;
  loading: boolean; error: string | null; onRetry: () => void;
  empty: { text: string; action?: { label: string; onPress: () => void } };
  onEndReached?: () => void; loadingMore?: boolean; listFooter?: ReactNode;
  onRefresh?: () => void; refreshing?: boolean;
  /** sticky, pass it only while something is selected */
  bulkBar?: ReactNode;
  /** the open item: a sheet on phones, the side panel on wide screens */
  detail?: { title: string; content: ReactNode; onClose: () => void } | null;
  /** wide screens with nothing open */
  detailHint?: string;
  onListWidth?: (w: number) => void;
}) {
  const { t, isArabic } = useL();
  const { g, row } = useGarageTheme();
  const twoPane = useTwoPane();
  const h = p.rowHeight ?? MANAGE_ROW_H;
  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <ManageHeader title={p.title} line={p.line} actions={p.actions} />
      {p.tabs ? <Tabs value={p.tabs.value} options={p.tabs.options} onChange={p.tabs.onChange} /> : null}
      {p.search ? <SearchBar value={p.search.value} onChangeText={p.search.onChange} placeholder={p.search.placeholder} /> : null}
      {p.filters}
      {p.above}
      {p.listHead}
      {p.error && p.items.length ? <ErrorNote text={p.error} /> : null}
    </View>
  );
  const empty = p.loading ? <SkeletonRows count={6} /> : p.error ? <ErrorState text={p.error} onRetry={p.onRetry} retryLabel={t("Retry", "إعادة المحاولة")} />
    : <EmptyState photo="empty.search" text={p.empty.text} action={p.empty.action} />;
  const list = (
    <View style={{ flex: 1, minWidth: 0 }} onLayout={e => p.onListWidth?.(e.nativeEvent.layout.width)}>
      <FlatList
        data={p.items}
        keyExtractor={p.keyOf}
        renderItem={({ item }) => p.renderItem(item)}
        getItemLayout={(_d, i) => ({ length: h, offset: h * i, index: i })}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<View style={{ paddingTop: 12, gap: 10 }}>{p.loadingMore ? <SkeletonRows count={2} /> : null}{p.listFooter}</View>}
        onEndReached={p.onEndReached}
        onEndReachedThreshold={0.6}
        initialNumToRender={14}
        maxToRenderPerBatch={20}
        windowSize={9}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={p.onRefresh ? <RefreshControl refreshing={!!p.refreshing} onRefresh={p.onRefresh} /> : undefined}
        // the gutter lives here (not on the page) so a full-bleed Rail in the header is not clipped
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: p.bulkBar ? 200 : p.tabBar ? 130 : 40 }}
      />
    </View>
  );
  return (
    <Page title={p.title} back={p.back ?? true} trail={p.trail} list maxWidth={twoPane ? 1240 : 760} footer={p.bulkBar}>
      {twoPane ? (
        <View style={[row, { flex: 1, gap: 4 }]}>
          {list}
          <View style={{ width: 400, paddingTop: 4, [isArabic ? "paddingLeft" : "paddingRight"]: 20 }}>
            <Card>
              {p.detail ? (
                <View style={{ gap: 10 }}>
                  <View style={[row, { alignItems: "center", gap: 8 }]}>
                    <GText style={[gType.title, { flex: 1, textAlign: isArabic ? "right" : "left" }]} numberOfLines={2}>{p.detail.title}</GText>
                    <Pressable accessibilityRole="button" accessibilityLabel={t("Close", "إغلاق")} onPress={p.detail.onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><GIcon name="close" size={20} /></Pressable>
                  </View>
                  {p.detail.content}
                </View>
              ) : (
                <View style={{ minHeight: 260, alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <GIcon name="albums-outline" size={30} color={g.soft} />
                  <GText soft style={[gType.bodySm, { textAlign: "center" }]}>{p.detailHint ?? t("Tap an item to see it here.", "اضغط على عنصر لعرضه هنا.")}</GText>
                </View>
              )}
            </Card>
          </View>
        </View>
      ) : list}
      {!twoPane ? (
        <Sheet visible={!!p.detail} onClose={() => p.detail?.onClose()} tall title={p.detail?.title ?? ""} closeLabel={t("Close", "إغلاق")}>
          {p.detail?.content ?? null}
        </Sheet>
      ) : null}
    </Page>
  );
}

function ErrorNote({ text }: { text: string }) {
  const { g, row, align } = useGarageTheme();
  return (
    <View style={[row, { alignItems: "center", gap: 8, padding: 10, borderRadius: gShape.small, backgroundColor: g.danger + "1A" }]}>
      <GIcon name="alert-circle-outline" size={18} color={g.danger} />
      <GText style={[gType.caption, align, { flex: 1, color: g.danger }]}>{text}</GText>
    </View>
  );
}

/** One item: [checkbox] [small photo] main text / secondary text [status] [⋮]. Fixed height; tap opens it. `columns` replace the two texts on
 *  wide lists. ⋮ = `actions` (the shared actions menu, with its sheet and toasts) or `onMenu` (the screen opens its own sheet). */
export function ManageRow({ title, sub, status, check, onPress, pressLabel, onMenu, actions, leading, active, columns, statusWidth, height = MANAGE_ROW_H }: {
  title: string; sub?: string; status?: { label: string; tone: Tone } | null;
  check?: { on: boolean; disabled?: boolean; label: string; onToggle: () => void };
  onPress?: () => void; pressLabel?: string; onMenu?: () => void; actions?: ItemAction[]; leading?: ReactNode; active?: boolean;
  columns?: ReactNode; statusWidth?: number; height?: number;
}) {
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  return (
    <View style={[row, { height, alignItems: "center", gap: 4, borderBottomWidth: 1, borderBottomColor: g.line, backgroundColor: active ? g.tint : check?.on ? g.cardSoft : "transparent" }]}>
      {check ? <ManageCheck on={check.on} disabled={check.disabled} label={check.label} onPress={check.onToggle} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={pressLabel ?? [title, sub, status?.label].filter(Boolean).join(". ")} onPress={onPress} disabled={!onPress}
        style={({ pressed }) => [row, { flex: 1, minWidth: 0, height, alignItems: "center", gap: 8, paddingHorizontal: check ? 0 : 4, opacity: pressed ? 0.7 : 1 }]}>
        {leading}
        {columns ?? (
          <View style={{ flex: 1, minWidth: 0 }}>
            <GText numberOfLines={1} style={[gType.label, align, { fontWeight: "700" }]}>{title}</GText>
            {sub ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{sub}</GText> : null}
          </View>
        )}
        {status ? <View style={{ width: statusWidth, alignItems: isArabic ? "flex-end" : "flex-start" }}><StatusChip label={status.label} tone={status.tone} /></View> : null}
      </Pressable>
      {actions?.length ? <ItemActionsMenu title={title} actions={actions} /> : onMenu ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${t("More actions for", "المزيد من الإجراءات لـ")} ${title}`} onPress={onMenu} hitSlop={4}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? g.tint : "transparent" })}>
          <GIcon name="ellipsis-vertical" size={22} color={g.soft} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 44 px touch target, 22 px box; "mixed" = some selected. */
export function ManageCheck({ on, mixed, disabled, label, onPress }: { on: boolean; mixed?: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  const { g } = useGarageTheme();
  const fill = on || mixed;
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: mixed ? "mixed" : on, disabled }} disabled={disabled} onPress={onPress} hitSlop={2}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}>
      <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: fill ? g.accent : g.soft, backgroundColor: fill ? g.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
        {on ? <GIcon name="checkmark" size={15} color={g.onAccent} /> : mixed ? <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: g.onAccent }} /> : null}
      </View>
    </Pressable>
  );
}

/** "The 50 on screen are selected. Select all 5,000 matching" / "All 5,000 are selected. Clear selection". */
export function SelectBanner({ text, action, onPress }: { text: string | null; action: string; onPress: () => void }) {
  const { g, row, align } = useGarageTheme();
  return (
    <View style={[row, { flexWrap: "wrap", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: gShape.small, backgroundColor: g.tint }]}>
      {text ? <GText style={[gType.caption, align]}>{text}</GText> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={{ minHeight: 36, justifyContent: "center" }}>
        <GText style={[gType.caption, align, { fontWeight: "800", color: g.accentText, textDecorationLine: "underline" }]}>{action}</GText>
      </Pressable>
    </View>
  );
}

/** A plain entry to another view of the same data ("Review by accessory · 4 accessories ›"): a row, never a big button. */
export function ManageEntry({ icon, title, sub, onPress }: { icon: GIconName; title: string; sub?: string; onPress: () => void }) {
  const { g, row, align, isArabic } = useGarageTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[title, sub].filter(Boolean).join(". ")} onPress={onPress}
      style={({ pressed }) => [row, { minHeight: 52, alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: pressed ? g.tint : g.card }]}>
      <GIcon name={icon} size={20} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText numberOfLines={1} style={[gType.label, align, { fontWeight: "700" }]}>{title}</GText>
        {sub ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{sub}</GText> : null}
      </View>
      <GIcon name={isArabic ? "chevron-back" : "chevron-forward"} size={18} color={g.soft} />
    </Pressable>
  );
}

/** Keeps the list width for "table" rows (one column per field once the list is wide enough). */
export function useListWidth() { const [w, setW] = useState(0); return { table: w >= 560, onListWidth: setW }; }

/** The list's ONE chip row (docs/guide/10-ui-system.md §3): "All" first, a count on each, at most ~5; scrolls sideways, never wraps. */
export function FilterChips<K extends string>({ filters, value, onChange }: { filters: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return <Rail gap={8}>{filters.map(f => <Chip key={f.key} label={f.label} count={f.count} on={value === f.key} onPress={() => onChange(f.key)} />)}</Rail>;
}

/** Application / company / shop / truck status (and document status): the same words and colours on every provider / admin screen. */
const APP_STATUS: Record<string, [Tone, string, string]> = {
  DRAFT: ["neutral", "Draft", "مسودة"], PENDING: ["accent", "Submitted", "تم الإرسال"], NEEDS_CHANGES: ["warning", "Needs changes", "مطلوب تعديلات"],
  APPROVED: ["success", "Approved", "معتمد"], REJECTED: ["danger", "Rejected", "مرفوض"],
};
const DOC_STATUS: Record<string, [Tone, string, string]> = { PENDING: ["warning", "Waiting", "بانتظار المراجعة"], ACCEPTED: ["success", "Accepted", "مقبول"], REJECTED: ["danger", "Rejected", "مرفوض"] };
export function appStatus(status: string, t: (en: string, ar: string) => string, kind: "app" | "doc" = "app") {
  const [tone, en, ar] = (kind === "doc" ? DOC_STATUS : APP_STATUS)[status] ?? APP_STATUS.DRAFT!;
  return { label: t(en, ar), tone };
}
