import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text} from './MotexaVisual';
import {useAppearance} from './Appearance';
import {useLanguage} from '../i18n/LanguageContext';

export default function AccountPreferences(){
 const {dark,mode,setMode}=useAppearance(),{isArabic:ar,language,setLanguage}=useLanguage();
 const ink=dark?'#FFF1DF':'#432D1E',muted=dark?'#D8BE9B':'#80664E',border=dark?'#806044':'#DCC4A4',surface=dark?'#392B21':'#FFF9EF',soft=dark?'#62472F':'#EDD5B2',row=ar?'row-reverse' as const:'row' as const,align=ar?'right' as const:'left' as const;
 const t=(en:string,arabic:string)=>ar?arabic:en;
 return <View style={{gap:14}}>
  <View style={{padding:15,borderRadius:25,borderWidth:1,borderColor:border,backgroundColor:surface,gap:12}}>
   <View style={{flexDirection:row,gap:9,alignItems:'center'}}><Ionicons name="language-outline" size={20} color={muted}/><Text accessibilityRole="header" style={{fontSize:14,lineHeight:24,fontWeight:'600',color:ink}}>{t('Interface language','لغة الواجهة')}</Text></View>
   <View accessibilityRole="radiogroup" style={{flexDirection:row,gap:8}}>{([{key:'en',label:'English'},{key:'ar',label:'العربية'}] as const).map(item=><Pressable key={item.key} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{checked:language===item.key}} onPress={()=>setLanguage(item.key)} style={{flex:1,minHeight:48,borderRadius:19,borderWidth:1,borderColor:border,alignItems:'center',justifyContent:'center',backgroundColor:language===item.key?soft:surface}}><Text style={{fontSize:13,lineHeight:23,color:ink}}>{item.label}</Text></Pressable>)}</View>
  </View>
  <View style={{padding:15,borderRadius:25,borderWidth:1,borderColor:border,backgroundColor:surface,gap:12}}>
   <View style={{flexDirection:row,gap:9,alignItems:'center'}}><Ionicons name="color-palette-outline" size={20} color={muted}/><Text accessibilityRole="header" style={{fontSize:14,lineHeight:24,fontWeight:'600',color:ink}}>{t('Appearance','المظهر')}</Text></View>
   <View accessibilityRole="radiogroup" style={{flexDirection:row,gap:7}}>{([{key:'light',en:'Light',ar:'نهاري',icon:'sunny-outline'},{key:'dark',en:'Dark',ar:'ليلي',icon:'moon-outline'},{key:'system',en:'System',ar:'الجهاز',icon:'phone-portrait-outline'}] as const).map(item=><Pressable key={item.key} accessibilityRole="radio" accessibilityLabel={ar?item.ar:item.en} accessibilityState={{checked:mode===item.key}} onPress={()=>setMode(item.key)} style={{flex:1,minHeight:68,borderRadius:20,borderWidth:1,borderColor:border,gap:4,alignItems:'center',justifyContent:'center',backgroundColor:mode===item.key?soft:surface}}><Ionicons name={item.icon} size={20} color={muted}/><Text style={{fontSize:11,lineHeight:20,color:ink}}>{ar?item.ar:item.en}</Text></Pressable>)}</View>
  </View>
  <Text style={{fontSize:11,lineHeight:22,color:muted,textAlign:align}}>{t('Saved on this device and applied throughout MOTEXA. System mode follows your device appearance.','تُحفظ على هذا الجهاز وتُطبّق في MOTEXA. وضع الجهاز يتبع إعدادات مظهر هاتفك.')}</Text>
 </View>;
}
