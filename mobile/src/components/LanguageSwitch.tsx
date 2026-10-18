import { useAppearance } from "./Appearance";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { Text } from './MotexaVisual';

export default function LanguageSwitch({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const {mode,dark,setMode}=useAppearance();
  const { language, setLanguage } = useLanguage();
  return <View style={{flexDirection:"row",gap:compact?8:10,alignItems:"center",flexWrap:"wrap"}}><View accessibilityRole="radiogroup" accessibilityLabel="Language / اللغة" style={[styles.container, compact && {padding:3}, light && !dark && styles.light]}>
    {(['en', 'ar'] as const).map(value => {
      const selected = language === value;
      return <Pressable key={value} accessibilityRole="radio" accessibilityState={{checked: selected}} accessibilityLabel={value === 'ar' ? 'العربية' : 'English'} onPress={() => setLanguage(value)} hitSlop={compact?5:3} style={({pressed, hovered}) => [styles.option, compact && {minWidth:30,minHeight:34,paddingHorizontal:7}, selected && styles.selected, (pressed || hovered) && {opacity: 0.78}]}>
        <Text style={[styles.text, compact && {fontSize:10}, light && !dark && styles.lightText, selected && styles.selectedText]}>{value === 'en' ? 'EN' : 'AR'}</Text>
      </Pressable>;
    })}
  </View><View accessibilityRole="radiogroup" accessibilityLabel={language==='ar'?'المظهر':'Appearance'} style={[styles.container,compact&&{padding:3},light&&!dark&&styles.light]}>
    {(['light','dark','system'] as const).map(value=><Pressable key={value} hitSlop={compact?5:3} accessibilityRole="radio" accessibilityState={{checked:mode===value}} accessibilityLabel={language==='ar'?({light:'فاتح',dark:'ليلي',system:'حسب الجهاز'})[value]:value} onPress={()=>setMode(value)} style={({pressed,hovered})=>[styles.option,compact&&{minWidth:30,minHeight:34,paddingHorizontal:7},mode===value&&styles.selected,(pressed||hovered)&&{opacity:.75}]}><Ionicons name={value==='light'?'sunny-outline':value==='dark'?'moon-outline':'phone-portrait-outline'} size={compact?15:17} color={mode===value?'#302116':dark?'#F4E8D8':'#754623'}/></Pressable>)}
  </View></View>;
}
const styles=StyleSheet.create({
  container:{flexDirection:'row',alignSelf:'flex-start',padding:4,borderRadius:24,backgroundColor:'#302219',borderWidth:1,borderColor:'#5C422F',gap:2},
  light:{backgroundColor:'#EBE0D2',borderColor:'#D8C7B3'},
  option:{minWidth:32,minHeight:40,paddingHorizontal:8,borderRadius:20,alignItems:'center',justifyContent:'center'},
  selected:{backgroundColor:'#DFAB78'},
  text:{color:'#C7AB91',fontSize:11,fontWeight:'700'},
  lightText:{color:'#85644B'},
  selectedText:{color:'#302116'},
});
