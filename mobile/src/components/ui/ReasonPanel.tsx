import { useState } from "react";
import { View } from "react-native";
import { Button } from "./Button";
import { Input } from "./Input";
import { useL } from "../../core/hooks/useL";

/** Reject-reason panel: a reason is required. */
export function ReasonPanel({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  required = true,
}: {
  title: string;
  confirmLabel: string;
  required?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const { t } = useL();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const bad = required && reason.trim().length < 3;
  return (
    <View style={{ marginTop: 12 }}>
      <Input
        label={title}
        value={reason}
        onChangeText={setReason}
        multiline
        error={touched && bad ? t("A reason is required.", "السبب مطلوب.") : undefined}
      />
      <View style={{ gap: 8 }}>
        <Button
          label={confirmLabel}
          variant="danger"
          onPress={() => {
            setTouched(true);
            if (!bad) onConfirm(reason.trim());
          }}
        />
        <Button label={t("Cancel", "إلغاء")} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
