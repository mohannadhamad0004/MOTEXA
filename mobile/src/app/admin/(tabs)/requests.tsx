import { useAppearanceStyles, useAppearance } from "../../../components/Appearance";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../../components/MotexaVisual";
import { CanvasFill, PanelFill } from "../../../components/BrandSurfaces";
import LanguageSwitch from "../../../components/LanguageSwitch";
import { useLanguage } from "../../../i18n/LanguageContext";
export default function RequestsScreen() {
  const styles = useAppearanceStyles(baseStyles);
  const { dark } = useAppearance();
 const {isArabic}=useLanguage(); const insets=useSafeAreaInsets();
 return <View style={styles.page}><CanvasFill/><ScrollView contentContainerStyle={[styles.content,{paddingTop:insets.top+24}]}>
 <LanguageSwitch light/><Text style={styles.eyebrow}>MOTEXA / {isArabic ? "مساحة الإدارة" : "WORKSPACE"}</Text>
 <Text style={styles.title}>{isArabic ? "الطلبات" : "Requests"}</Text>
 <Text style={styles.subtitle}>{isArabic ? "كل خطوة واضحة. كل خدمة باهتمام." : "Every step considered. Every service matters."}</Text>
 <View style={styles.card}><PanelFill kind="light" radius={26}/><View style={styles.icon}><Ionicons name="receipt-outline" size={34} color="#754623"/></View>
 <Text style={styles.cardTitle}>{isArabic ? "مساحة مخصّصة لإدارة الطلبات" : "A dedicated space for requests"}</Text>
 <Text style={styles.body}>{isArabic ? "واجهة الطلبات قيد التجهيز. ستظهر هنا الطلبات بعد استكمال ربط هذا القسم." : "This section is being prepared. Requests will appear here once its connection is implemented."}</Text>
 <View style={styles.badge}><Text style={styles.badgeText}>{isArabic ? "قريبًا" : "COMING SOON"}</Text></View>
 </View></ScrollView></View>;
}
const baseStyles = StyleSheet.create({page:{flex:1},content:{paddingHorizontal:24,paddingBottom:36,width:"100%",maxWidth:800,alignSelf:"center"},eyebrow:{color:"#754623",fontSize:11,fontWeight:"800",letterSpacing:1.5,marginTop:32},title:{color:"#30241D",fontSize:34,fontWeight:"800",marginTop:10},subtitle:{color:"#574737",fontSize:15,lineHeight:25,marginTop:10},card:{padding:28,borderRadius:26,borderWidth:1,borderColor:"#CBB18D",marginTop:30,alignItems:"center"},icon:{width:76,height:76,borderRadius:24,backgroundColor:"#EAD0AB",alignItems:"center",justifyContent:"center",marginVertical:16},cardTitle:{color:"#30241D",fontSize:21,fontWeight:"800",textAlign:"center",lineHeight:32,marginTop:12},body:{color:"#574737",fontSize:15,lineHeight:26,textAlign:"center",marginTop:12},badge:{backgroundColor:"#E8D1B0",paddingHorizontal:16,paddingVertical:9,borderRadius:12,marginTop:24,marginBottom:12},badgeText:{color:"#633B1C",fontWeight:"800",fontSize:12}});
