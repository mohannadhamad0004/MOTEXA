import {Text,HeroReveal,useReducedMotion} from "./MotexaVisual";
import {PanelFill} from "./BrandSurfaces";
import {useAppearance} from "./Appearance";
import {useLanguage} from "../i18n/LanguageContext";

import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  View,
} from "react-native";

type DialogType = "confirm" | "success" | "error" | "warning";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  type?: DialogType;
  icon?: keyof typeof Ionicons.glyphMap;
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
  icon,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const {dark}=useAppearance();
  const reduced=useReducedMotion();
  const {isArabic}=useLanguage();
  const ink=dark?"#FFF0DC":"#38281D", muted=dark?"#D2B99A":"#705640";
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
      animationType={reduced?'none':'fade'}
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View style={styles.overlay}>
        <HeroReveal accessibilityViewIsModal style={[styles.card,{maxHeight:"88%"}]}><PanelFill radius={32}/><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{alignItems:"center",flexGrow:1}}>
          <View style={[styles.iconCircle,{backgroundColor:dark?"#58432E":"#F3DFC5"}]}>
            <Ionicons
              name={icon || icons[type]}
              size={28}
              color={type==="success"?"#377250":type==="error"?"#A84436":dark?"#E6BE88":"#8B5B32"}
            />
          </View>

          <Text accessibilityRole="header" style={[styles.title,{color:ink}]}>{title}</Text>
          <Text style={[styles.message,{color:muted}]}>{message}</Text>

          <View style={[styles.actions,{flexDirection:isArabic?"row-reverse":"row"}]}>
            <Pressable
              accessibilityRole="button"
              style={({pressed})=>[styles.cancelButton,{backgroundColor:"transparent",opacity:pressed?0.75:1}]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelText,{color:ink}]}>{cancelText}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={({pressed})=>[
                styles.confirmButton,
                {opacity:pressed?0.8:1},
                isDanger && styles.dangerButton,
                loading && { opacity: 0.6 },
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF7EB" />
              ) : (
                <Text style={styles.confirmText}>
                  {confirmText}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView></HeroReveal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    minWidth:100,
    minHeight:48,
    backgroundColor: "rgba(36,25,17,0.48)",
    justifyContent: "center",
    padding: 22,
  },
  card: {
    overflow:"hidden",
    maxWidth:440,
    width:"100%",
    alignSelf:"center",
    borderRadius: 32,
    padding: 25,
    borderWidth: 1,
    borderColor: "#DEC5A3",
    alignItems: "center",
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#493024",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: "#FFF1E6",
    fontSize: 21,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    color: "#C6A48B",
    fontSize: 13,
    lineHeight: 23,
    textAlign: "center",
    marginBottom: 23,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    minWidth:100,
    minHeight:48,
    justifyContent:'center',
    backgroundColor: "transparent",
    borderWidth:1,
    borderColor:"#C8A47B",
    paddingVertical: 15,
    borderRadius: 24,
    alignItems: "center",
  },
  cancelText: {
    color: "#EAD6C6",
    fontWeight: "600",
  },
  confirmButton: {
    flex: 1,
    minWidth:100,
    minHeight:48,
    justifyContent:'center',
    backgroundColor: "#573822",
    paddingVertical: 15,
    borderRadius: 24,
    alignItems: "center",
  },
  dangerButton: {
    backgroundColor: "#573822",
  },
  confirmText: {
    color: "#FFF7EB",
    fontWeight: "600",
  },
});
