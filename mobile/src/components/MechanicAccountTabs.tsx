import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
type Item={key:string;icon:keyof typeof Ionicons.glyphMap;label:string};
export default function MechanicAccountTabs({items,selected,onSelect}:{items:Item[];selected:string;onSelect:(key:string)=>void}){
 const m=useMechanicTheme();return <View style={{flexDirection:m.row,padding:5,borderRadius:25,borderWidth:1,borderColor:m.border,backgroundColor:m.surface,gap:3,boxShadow:'0px 3px 16px rgba(67,45,30,0.07)'}}>{items.map(item=>{const active=item.key===selected;return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected:active}} onPress={()=>onSelect(item.key)} style={({pressed})=>({flex:1,minHeight:58,borderRadius:19,gap:5,alignItems:'center',justifyContent:'center',backgroundColor:active?m.soft:'transparent',opacity:pressed?.7:1})}><Ionicons name={item.icon} size={20} color={active?m.ink:m.muted}/><Text numberOfLines={1} adjustsFontSizeToFit style={{fontSize:10,lineHeight:17,color:active?m.ink:m.muted,fontWeight:active?'600':'400',paddingHorizontal:2}}>{item.label}</Text></Pressable>})}</View>;
}
