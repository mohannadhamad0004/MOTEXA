// Multi-step and status pieces: StepperHeader, StickyActionBar, Timeline (vertical), chat Bubble / DateSeparator / SystemPill, Tabs.
import { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { Tap } from "./primitives";
import { GIcon, GText } from "./text";

/** "Step 2 of 3 · Details" + a segmented progress line. */
export function StepperHeader({ steps, index, label }: { steps: string[]; index: number; label: (i: number, n: number) => string }) {
  const { g, row, align } = useGarageTheme();
  return (
    <View style={{ gap: 8, marginBottom: 16 }} accessibilityLabel={`${label(index + 1, steps.length)} · ${steps[index]}`}>
      <GText soft style={[gType.caption, align, { fontWeight: "700" }]}>{`${label(index + 1, steps.length)} · ${steps[index]}`}</GText>
      <View style={[row, { gap: 6 }]}>
        {steps.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= index ? g.accent : g.line }} />
        ))}
      </View>
    </View>
  );
}

/** Bar pinned to the bottom (above the home indicator): card colour, top line, one or two actions. */
export function StickyActionBar({ children, note }: { children: ReactNode; note?: string }) {
  const { g, row, align } = useGarageTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom, backgroundColor: g.card, borderTopWidth: 1, borderTopColor: g.line }}>
      {note ? <GText soft style={[gType.caption, align, { marginBottom: 8 }]}>{note}</GText> : null}
      <View style={[row, { gap: 10 }]}>{children}</View>
    </View>
  );
}

export type TimelineStep = { label: string; at?: string; state: "done" | "current" | "todo" | "failed" };

/** Vertical status timeline: filled dots for done, a ring for the current step, hollow for later ones. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  const { g, row, align } = useGarageTheme();
  return (
    <View>
      {steps.map((s, i) => {
        const c = s.state === "failed" ? g.danger : s.state === "todo" ? g.line : g.accent;
        const last = i === steps.length - 1;
        return (
          <View key={s.label + i} style={[row, { gap: 12 }]}>
            <View style={{ alignItems: "center", width: 22 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c, backgroundColor: s.state === "done" || s.state === "failed" ? c : g.card, alignItems: "center", justifyContent: "center" }}>
                {s.state === "done" ? <GIcon name="checkmark" size={13} color={g.onAccent} /> : s.state === "failed" ? <GIcon name="close" size={13} color="#FFFFFF" /> : s.state === "current" ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /> : null}
              </View>
              {!last ? <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: s.state === "done" ? g.accent : g.line }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
              <GText style={[gType.label, align, { color: s.state === "todo" ? g.soft : s.state === "failed" ? g.danger : g.ink, fontWeight: s.state === "current" ? "800" : "600" }]}>{s.label}</GText>
              {s.at ? <GText soft style={[gType.caption, align]}>{s.at}</GText> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Chat bubble: mine = accent on the end side; theirs = card on the start side. Mirrors in Arabic. */
export function Bubble({ mine, text, meta }: { mine: boolean; text: string; meta?: string }) {
  const { g, isArabic, align } = useGarageTheme();
  const end = mine !== isArabic; // the visual right edge
  return (
    <View style={{ alignSelf: end ? "flex-end" : "flex-start", maxWidth: "82%", marginVertical: 4 }}>
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          borderBottomRightRadius: end ? 6 : 20,
          borderBottomLeftRadius: end ? 20 : 6,
          backgroundColor: mine ? g.accent : g.card,
          borderWidth: mine ? 0 : 1,
          borderColor: g.line,
        }}
      >
        <GText style={[gType.bodySm, align, { color: mine ? g.onAccent : g.ink }]}>{text}</GText>
      </View>
      {meta ? <GText soft style={[gType.tiny, { marginTop: 3, textAlign: end ? "right" : "left" }]}>{meta}</GText> : null}
    </View>
  );
}

export function DateSeparator({ label }: { label: string }) {
  const { g } = useGarageTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: g.line }} />
      <GText soft style={gType.tiny}>{label}</GText>
      <View style={{ flex: 1, height: 1, backgroundColor: g.line }} />
    </View>
  );
}

export function SystemPill({ text }: { text: string }) {
  const { g } = useGarageTheme();
  return (
    <View style={{ alignSelf: "center", marginVertical: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: gShape.pill, backgroundColor: g.tint }}>
      <GText style={[gType.tiny, { fontWeight: "700", color: g.soft, textAlign: "center" }]}>{text}</GText>
    </View>
  );
}

/** Segmented tabs (Active / Past). */
export function Tabs<K extends string>({ value, options, onChange }: { value: K; options: { key: K; label: string; count?: number }[]; onChange: (k: K) => void }) {
  const { g, row } = useGarageTheme();
  return (
    <View style={[row, { padding: 4, gap: 4, borderRadius: gShape.pill, backgroundColor: g.tint }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Tap key={o.key} role="tab" label={o.label} onPress={() => onChange(o.key)} style={[row, { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 6, borderRadius: gShape.pill, backgroundColor: on ? g.card : "transparent" }]}>
            <GText style={[gType.label, { fontWeight: on ? "800" : "600", color: on ? g.ink : g.soft }]}>{o.label}</GText>
            {o.count ? <GText style={[gType.tiny, { fontWeight: "800", color: g.accentText }]}>{o.count}</GText> : null}
          </Tap>
        );
      })}
    </View>
  );
}
