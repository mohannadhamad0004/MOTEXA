
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DialogType = "confirm" | "success" | "error" | "warning";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function MotexaDialog({
  visible,
  title,
  message,
  type = "confirm",
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const icons = {
    confirm: "help-circle-outline",
    success: "checkmark-circle-outline",
    error: "close-circle-outline",
    warning: "warning-outline",
  } as const;

  const isDanger = type === "error" || type === "warning";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={icons[type]}
              size={30}
              color="#E0A36F"
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.confirmButton,
                isDanger && styles.dangerButton,
                loading && { opacity: 0.6 },
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#21130C" />
              ) : (
                <Text style={styles.confirmText}>
                  {confirmText}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#2B1D15",
    borderRadius: 24,
    padding: 25,
    borderWidth: 1,
    borderColor: "#5C3B29",
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#493024",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: "#FFF1E6",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    color: "#C6A48B",
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    marginBottom: 26,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#3A291F",
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
  },
  cancelText: {
    color: "#EAD6C6",
    fontWeight: "800",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#E0A36F",
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
  },
  dangerButton: {
    backgroundColor: "#D99B69",
  },
  confirmText: {
    color: "#24160F",
    fontWeight: "900",
  },
});
