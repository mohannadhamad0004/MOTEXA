import {useEffect,useRef} from 'react';
import {Animated,StyleSheet,View} from 'react-native';
import {useAppearance} from './Appearance';
import {PanelFill} from './BrandSurfaces';
import {Text,useReducedMotion} from './MotexaVisual';
/** Decorative placeholders only; no invented values or accounts. */
export function LoadingState({label,rows=2}:{label:string;rows?:number}){
 const {dark}=useAppearance(),reduced=useReducedMotion(),opacity=useRef(new Animated.Value(1)).current;
 useEffect(()=>{if(reduced){opacity.setValue(1);return;}const animation=Animated.loop(Animated.sequence([Animated.timing(opacity,{toValue:.48,duration:650,useNativeDriver:true,isInteraction:false}),Animated.timing(opacity,{toValue:1,duration:650,useNativeDriver:true,isInteraction:false})]));animation.start();return()=>{animation.stop();opacity.setValue(1);};},[opacity,reduced]);
 return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.container}>
  <Text style={{color:dark?'#DEC3A1':'#62452D',fontSize:13,lineHeight:22}}>{label}</Text>
  <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{opacity,gap:12}}>{Array.from({length:rows},(_,index)=><View key={index} style={styles.card}><PanelFill radius={24}/><View style={[styles.avatar,{backgroundColor:dark?'#71553A':'#E3C9A6'}]}/><View style={{flex:1,gap:12}}><View style={[styles.line,{width:'64%',backgroundColor:dark?'#71553A':'#E3C9A6'}]}/><View style={[styles.line,{width:'88%',height:8,backgroundColor:dark?'#604A35':'#EAD8BF'}]}/></View></View>)}</Animated.View>
 </View>;
}
const styles=StyleSheet.create({container:{gap:14,paddingVertical:12},card:{minHeight:100,padding:20,borderRadius:24,overflow:'hidden',flexDirection:'row',alignItems:'center',gap:14},avatar:{width:44,height:44,borderRadius:16},line:{height:12,borderRadius:6}});
