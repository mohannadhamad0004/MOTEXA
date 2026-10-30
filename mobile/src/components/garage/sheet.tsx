// Bottom sheet + single-choice option sheet in the garage style (Modal: slide up, dim backdrop, tap outside / Close to dismiss).
import { ReactNode } from "react";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduced } from "../../motion";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { IconButton, Tap } from "./primitives";
import { GIcon, GText } from "./text";

export function Sheet({ visible, onClose, title, children, footer, tall, closeLabel = "Close" }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; tall?: boolean; closeLabel?: string }) {
  const { g, row, align } = useGarageTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReduced();
  return (
    <Modal visible={visible} transparent animationType={reduced ? "fade" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityLabel={closeLabel} onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(23,16,12,0.45)" }} />
        <View style={{ maxHeight: height * (tall ? 0.88 : 0.72), backgroundColor: g.page, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: footer ? 0 : insets.bottom + 12 }}>
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: g.line }} />
          </View>
          <View style={[row, { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 12 }]}>
            <GText accessibilityRole="header" style={[gType.title, align, { flex: 1 }]}>{title}</GText>
            <IconButton icon="close" label={closeLabel} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: g.line, backgroundColor: g.card }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function OptionSheet<K extends string>({ visible, onClose, title, value, options, onSelect, closeLabel, header }: { visible: boolean; onClose: () => void; title: string; value: K; options: { key: K; label: string }[]; onSelect: (k: K) => void; closeLabel?: string; header?: ReactNode }) {
  const { g, row, align } = useGarageTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
      <View style={{ gap: 8 }}>
        {header}
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Tap key={o.key} label={o.label} onPress={() => onSelect(o.key)} style={[row, { minHeight: 52, alignItems: "center", gap: 12, paddingHorizontal: 16, borderRadius: gShape.small, backgroundColor: on ? g.tint : g.card, borderWidth: 1, borderColor: on ? g.accent : g.line }]}>
              <GText style={[gType.label, align, { flex: 1, fontWeight: on ? "800" : "600" }]}>{o.label}</GText>
              {on ? <GIcon name="checkmark-circle" size={20} /> : null}
            </Tap>
          );
        })}
      </View>
    </Sheet>
  );
}
