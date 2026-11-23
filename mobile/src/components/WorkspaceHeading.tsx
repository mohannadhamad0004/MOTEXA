import {View} from 'react-native';
import {useFonts} from 'expo-font';
import {Text} from './MotexaVisual';
import {useAppearance} from './Appearance';
import {useLanguage} from '../i18n/LanguageContext';

/** Editorial introduction; operational labels retain the standard readable typeface. */
export default function WorkspaceHeading({title,description,eyebrow}:{title:string;description?:string;eyebrow?:string}) {
  const {dark}=useAppearance();const {isArabic}=useLanguage();
  const [ready]=useFonts({MotexaWorkspaceScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaWorkspaceArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});
  const align=isArabic?'right':'left';
  return <View style={{paddingVertical:14,gap:5}}>
    {!!eyebrow&&<Text style={{fontSize:10,lineHeight:19,letterSpacing:isArabic?0:1.4,color:dark?'#D9BA93':'#8A6240',textAlign:align}}>{eyebrow}</Text>}
    <Text accessibilityRole="header" style={{fontFamily:ready?(isArabic?'MotexaWorkspaceArabic':'MotexaWorkspaceScript'):undefined,fontSize:isArabic?29:40,lineHeight:isArabic?44:52,color:dark?'#FFF1DF':'#432D1E',textAlign:align}}>{title}</Text>
    {!!description&&<Text style={{fontSize:13,lineHeight:23,color:dark?'#D9C3A5':'#765A43',textAlign:align}}>{description}</Text>}
  </View>;
}
