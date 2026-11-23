import {View,ActivityIndicator} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text} from './MotexaVisual';
import {MechanicButton,useMechanicTheme} from './MechanicUI';

export default function MechanicStageActions({step,busy,onContinue,onPrevious,onSave}:{step:number;busy:boolean;onContinue:()=>void;onPrevious:()=>void;onSave:()=>void}){
 const m=useMechanicTheme();return <View style={{gap:10,paddingTop:3}}><View style={{flexDirection:m.row,gap:10}}>{step>0&&<View style={{flex:1}}><MechanicButton secondary label={m.t('Previous step','الخطوة السابقة')} disabled={busy} onPress={onPrevious}/></View>}{step<3&&<View style={{flex:step>0?1.4:1}}><MechanicButton label={m.t('Save and continue','حفظ ومتابعة')} busy={busy} onPress={onContinue}/></View>}</View><Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Save draft and close','حفظ المسودة وإغلاق')} accessibilityState={{disabled:busy}} disabled={busy} onPress={onSave} style={{minHeight:46,flexDirection:m.row,alignItems:'center',justifyContent:'center',gap:8,opacity:busy?.5:1}}>{busy?<ActivityIndicator size="small" color={m.muted}/>:<Ionicons name="bookmark-outline" size={16} color={m.muted}/>}<Text style={{fontSize:12,lineHeight:23,color:m.muted}}>{m.t('Save draft and close','حفظ المسودة وإغلاق')}</Text></Pressable></View>;
}
