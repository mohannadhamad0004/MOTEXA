import {useState} from 'react';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Pressable from './MotionPressable';
import TextInput from './PremiumTextInput';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

export default function ApplicationSearchTools({query,onQuery,statusLabel,onStatus,onReset,filtered}:{query:string;onQuery:(value:string)=>void;statusLabel:string;onStatus:()=>void;onReset:()=>void;filtered:boolean}){
 const m=useMechanicTheme(),[focused,setFocused]=useState(false);
 return <View style={{gap:5}}><View style={{minHeight:59,borderWidth:1,borderColor:focused?(m.dark?'#D0AC7E':'#AE8250'):m.border,borderRadius:23,backgroundColor:m.surface,flexDirection:m.row,alignItems:'center',paddingHorizontal:6,gap:5}}>
  <Ionicons name="search-outline" size={20} color={m.muted} style={{marginHorizontal:6}}/>
  <TextInput accessibilityLabel={m.t('Search mechanics','البحث عن ميكانيكي')} value={query} onChangeText={onQuery} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} placeholder={m.t('Name, city or specialty','الاسم أو المدينة أو التخصص')} autoCorrect={false} returnKeyType="search" style={{flex:1,minWidth:0,minHeight:55,fontSize:12,lineHeight:23,color:m.ink,textAlign:m.align}}/>
  {!!query&&<Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Clear search','مسح البحث')} onPress={()=>onQuery('')} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="close-circle-outline" size={18} color={m.muted}/></Pressable>}
  <View style={{height:25,width:1,backgroundColor:m.border}}/>
  <Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={statusLabel} accessibilityHint={m.t('Choose an application status','اختيار حالة الطلب')} onPress={onStatus} style={({pressed})=>({width:44,height:44,borderRadius:17,backgroundColor:m.soft,alignItems:'center',justifyContent:'center',opacity:pressed?.7:1})}><Ionicons name="options-outline" size={22} color={m.ink}/>{filtered&&<View pointerEvents="none" style={{position:'absolute',top:6,right:6,width:5,height:5,borderRadius:3,backgroundColor:m.muted}}/>}</Pressable>
 </View><View style={{flexDirection:m.row,minHeight:29,paddingHorizontal:7,gap:8,alignItems:'center'}}><Text style={{flex:1,fontSize:11,lineHeight:21,color:m.muted,textAlign:m.align}}>{statusLabel}</Text>{filtered&&<Pressable focusVisibleOnly accessibilityRole="button" accessibilityLabel={m.t('Reset filters','مسح التصنيفات')} onPress={onReset} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:11,lineHeight:21,color:m.ink,fontWeight:'600'}}>{m.t('Reset','مسح')}</Text></Pressable>}</View></View>;
}
