import { Ionicons } from "@expo/vector-icons";
import { Pressable, TextInput, TextInputProps, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../../theme/useTheme";
import { useL } from "../../core/hooks/useL";

export function Input({ label, error, ...p }: TextInputProps & { label: string; error?: string }) {
  const { c, r, align, isArabic } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[{ color: c.text, fontSize: 12, fontWeight: "700", marginBottom: 7 }, align]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textDim}
        accessibilityLabel={label}
        {...p}
        style={[
          {
            minHeight: 54,
            borderRadius: r.lg,
            borderWidth: 1,
            borderColor: error ? c.dangerBorder : c.border,
            backgroundColor: c.field,
            color: c.text,
            paddingHorizontal: 15,
            fontSize: 14,
            textAlign: isArabic ? "right" : "left",
          },
          p.multiline && { minHeight: 92, textAlignVertical: "top", paddingTop: 12 },
        ]}
      />
      {error ? <Text style={[{ color: c.danger, fontSize: 12, marginTop: 5 }, align]}>{error}</Text> : null}
    </View>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { c, r, row, isArabic } = useTheme();
  const { t } = useL();
  return (
    <View
      style={[
        row,
        {
          height: 56,
          borderRadius: r.lg,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.field,
          alignItems: "center",
          paddingHorizontal: 16,
          marginBottom: 14,
        },
      ]}
    >
      <Ionicons name="search-outline" size={20} color={c.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textDim}
        accessibilityLabel={placeholder}
        style={{ flex: 1, height: "100%", color: c.text, marginHorizontal: 10, fontSize: 15, textAlign: isArabic ? "right" : "left" }}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange("")} accessibilityLabel={t("Clear", "مسح")} hitSlop={8} style={{ padding: 8 }}>
          <Ionicons name="close-circle" size={19} color={c.textDim} />
        </Pressable>
      )}
    </View>
  );
}
