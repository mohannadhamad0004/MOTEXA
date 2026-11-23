import {OwnerEditorial} from './CustomerType';
import {View} from 'react-native';
import type {ReactNode} from 'react';
import {LinearGradient} from 'expo-linear-gradient';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
import {OwnerButton} from './OwnerControls';

export function OwnerHeading({kicker,title,accent,description}:{kicker:string;title:string;accent?:string;description?:string}){
 const m=useMechanicTheme();return <View style={{gap:9,paddingTop:17,paddingBottom:4}}><View style={{flexDirection:m.row,alignItems:'center',gap:9}}><View style={{width:23,height:1,backgroundColor:m.bronze}}/><Text style={{fontSize:11,letterSpacing:m.ar?0:2,color:m.bronze,textAlign:m.align}}>{kicker}</Text></View><OwnerEditorial>{title}{accent?'\n'+accent:''}</OwnerEditorial>{!!description&&<Text style={{fontSize:12,lineHeight:25,color:m.muted,textAlign:m.align,maxWidth:450}}>{description}</Text>}</View>;
}
export function OwnerAction({label,onPress,secondary=false,disabled=false}:{label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){return <OwnerButton label={label} onPress={onPress} secondary={secondary} disabled={disabled}/>;}
export function OwnerSectionLabel({children,aside}:{children:ReactNode;aside?:string}){const m=useMechanicTheme();return <View style={{flexDirection:m.row,alignItems:'center',gap:10,paddingVertical:9}}><Text style={{fontSize:12,letterSpacing:m.ar?0:1.7,color:m.muted,textAlign:m.align}}>{children}</Text><View style={{height:1,flex:1,backgroundColor:m.border}}/>{!!aside&&<Text style={{fontSize:12,color:m.bronze}}>{aside}</Text>}</View>;}
export function OwnerBookingRail({step}:{step:1|2|3|4}){const m=useMechanicTheme(),names=[m.t('Service','الخدمة'),m.t('Mechanic','الميكانيكي'),m.t('Details','التفاصيل'),m.t('Review','المراجعة')];return <View accessibilityLabel={m.t('Booking step ','خطوة الطلب ')+step} style={{flexDirection:m.row,paddingTop:16,paddingBottom:4,gap:7}}>{names.map((label,i)=><View key={label} style={{flex:1,gap:8}}><View style={{height:2,backgroundColor:i<step?m.bronze:m.border}}/><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85} style={{fontSize:12,lineHeight:22,color:i===step-1?m.ink:m.muted,fontWeight:i===step-1?'600':'400',textAlign:m.align}}>{label}</Text></View>)}</View>;}
export function OwnerMaterial({children}:{children:ReactNode}){const m=useMechanicTheme();return <View style={{borderRadius:26,borderWidth:1,borderColor:m.border,overflow:'hidden'}}><LinearGradient accessible={false} pointerEvents="none" colors={m.dark?['#35231A','#241913']:['#FFFCF6','#F5E8D7']} start={{x:0,y:0}} end={{x:1,y:1}} style={{position:'absolute',inset:0}}/>{children}</View>;}
