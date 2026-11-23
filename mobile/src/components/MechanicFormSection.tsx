import {useFonts} from 'expo-font';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import Pressable from './MotionPressable';

export function MechanicFormSection({title,description,icon,number}:{title:string;description?:string;icon:keyof typeof Ionicons.glyphMap;number:string}){
 const m=useMechanicTheme();const[ready]=useFonts({MotexaFormScript:require('../../assets/fonts/GreatVibes-Regular.ttf'),MotexaFormArabic:require('../../assets/fonts/Tajawal-Medium.ttf')});return <View style={{gap:6,paddingTop:7,paddingBottom:12,borderBottomWidth:1,borderColor:m.border,marginBottom:4}}><View style={{flexDirection:m.row,alignItems:'center',gap:10}}><View style={{width:27,height:35,borderRadius:0,backgroundColor:'transparent',alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={19} color={m.muted}/></View><Text style={{flex:1,fontFamily:ready?(m.ar?'MotexaFormArabic':'MotexaFormScript'):undefined,fontSize:m.ar?23:32,lineHeight:m.ar?37:43,fontWeight:'400',color:m.ink,textAlign:m.align}}>{title}</Text><Text style={{fontSize:10,color:m.muted,lineHeight:20}}>{number}</Text></View>{!!description&&<Text style={{fontSize:12,lineHeight:23,color:m.muted,textAlign:m.align}}>{description}</Text>}</View>;
}
export function MechanicSpecialtyTile({label,selected,onPress,disabled,icon}:{label:string;selected:boolean;onPress:()=>void;disabled:boolean;icon:keyof typeof Ionicons.glyphMap}){
 const m=useMechanicTheme();return <Pressable focusVisibleOnly accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked:selected,disabled}} aria-checked={selected} disabled={disabled} onPress={onPress} style={{flexGrow:1,flexBasis:'45%',minHeight:98,padding:14,borderRadius:18,borderBottomLeftRadius:6,borderWidth:1,borderColor:selected?(m.dark?'#D2AD7D':'#A47A4C'):m.border,backgroundColor:selected?m.soft:m.surface,gap:9,opacity:disabled?.6:1}}><View style={{flexDirection:m.row,justifyContent:'space-between',alignItems:'center'}}><Ionicons name={icon} size={22} color={m.muted}/><Ionicons name={selected?'checkmark-circle':'ellipse-outline'} size={17} color={m.muted}/></View><Text style={{fontSize:13,lineHeight:24,fontWeight:'600',color:m.ink,textAlign:m.align}}>{label}</Text></Pressable>;
}
