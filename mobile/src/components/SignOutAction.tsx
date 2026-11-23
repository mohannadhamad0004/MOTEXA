import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
export default function SignOutAction({onPress,disabled=false}:{onPress:()=>void;disabled?:boolean}) {
 const m=useMechanicTheme();
 return <Pressable accessibilityRole="button" accessibilityLabel={m.t('Sign out','تسجيل الخروج')} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>({minHeight:78,borderRadius:27,borderWidth:1,borderColor:m.border,backgroundColor:m.surface,padding:15,flexDirection:m.row,alignItems:'center',gap:12,opacity:disabled?.5:pressed?.78:1,marginTop:12,marginBottom:8})}>
  <View style={{width:44,height:44,borderRadius:22,backgroundColor:m.dark?'#533B2D':'#F2E2CE',alignItems:'center',justifyContent:'center'}}><Ionicons name="log-out-outline" size={22} color={m.dark?'#E7BF98':'#875B3B'}/></View>
  <View style={{flex:1,gap:3}}><Text style={{fontSize:14,lineHeight:23,color:m.ink,textAlign:m.align,fontWeight:'600'}}>{m.t('Sign out','تسجيل الخروج')}</Text><Text style={{fontSize:11,lineHeight:19,color:m.muted,textAlign:m.align}}>{m.t('Leave your current session securely.','إنهاء جلستك الحالية بأمان.')}</Text></View>
  <Ionicons name={m.ar?'chevron-back':'chevron-forward'} size={17} color={m.muted}/>
 </Pressable>;
}
