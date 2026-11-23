import {useFonts} from 'expo-font';
import {LinearGradient} from 'expo-linear-gradient';
import BrandMonogram from './BrandMonogram';
import Pressable from "./MotionPressable";
import {Text,HeroReveal,useReducedMotion} from "./MotexaVisual";
import {PanelFill} from "./BrandSurfaces";
import {useAppearance} from "./Appearance";
import {useLanguage} from "../i18n/LanguageContext";

import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
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
  singleAction?: boolean;
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
  singleAction = false,
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

  const signOut=icon==='log-out-outline';
  const branded=signOut||(type==='error'&&icon==='lock-closed-outline');
  const [exitFontsReady]=useFonts({MotexaExitTitle:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaExitTitleArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
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
        <HeroReveal accessibilityViewIsModal style={[styles.card,{maxHeight:"88%"},branded&&{maxWidth:320,padding:20}]}><PanelFill radius={32}/>{branded&&<><LinearGradient pointerEvents="none" colors={dark?["#3E2D21","#30231B","#503724"]:["#FFFAF1","#FAEFDF","#EDD2AF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><BrandMonogram size={155} style={{top:5,left:-42,opacity:.04}}/></>}<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{alignItems:"center",flexGrow:1}}>
          {branded&&<Text style={{fontSize:10,lineHeight:20,letterSpacing:isArabic?0:1.5,color:muted,marginBottom:9}}>{signOut?(isArabic?"MOTEXA / جلستك":"MOTEXA / YOUR SESSION"):(isArabic?"MOTEXA / دخول آمن":"MOTEXA / SECURE ACCESS")}</Text>}
          <View style={[styles.iconCircle,{backgroundColor:dark?"#58432E":"#F3DFC5"},branded&&{width:48,height:52,borderRadius:17,marginBottom:10,borderWidth:1,borderColor:dark?"#916C47":"#D8B68C"}]}>
            <Ionicons
              name={signOut?"exit-outline":icon || icons[type]}
              size={signOut?25:28}
              color={type==="success"?"#377250":type==="error"?"#A84436":dark?"#E6BE88":"#8B5B32"}
            />
          </View>

          <Text accessibilityRole="header" style={[styles.title,{color:ink},branded&&{fontFamily:exitFontsReady?(isArabic?"MotexaExitTitleArabic":"MotexaExitTitle"):undefined,fontSize:isArabic?25:32,lineHeight:isArabic?38:41,fontWeight:"400",marginBottom:8}]}>{title}</Text>
          <Text style={[styles.message,{color:muted},branded&&{fontSize:12,lineHeight:21,marginBottom:16}]}>{message}</Text>

          <View style={[styles.actions,{flexDirection:isArabic?"row-reverse":"row"},branded&&{gap:8}]}>
            {!singleAction&&(<Pressable
              accessibilityRole="button"
              style={({pressed})=>[styles.cancelButton,{backgroundColor:"transparent",opacity:pressed?0.75:1},branded&&{paddingVertical:10,minHeight:44,minWidth:94,borderRadius:19}]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.cancelText,{color:ink},branded&&{fontSize:12,lineHeight:21}]}>{cancelText}</Text>
            </Pressable>)}

            <Pressable
              accessibilityRole="button"
              style={({pressed})=>[
                styles.confirmButton,
                {opacity:pressed?0.8:1},
                isDanger && styles.dangerButton,
                branded&&{paddingVertical:10,minHeight:44,minWidth:94,borderRadius:19,backgroundColor:dark?"#91643B":"#80532E"},
                loading && { opacity: 0.6 },
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF7EB" />
              ) : (
                <Text style={[styles.confirmText,branded&&{fontSize:12,lineHeight:21}]}>
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
