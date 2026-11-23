import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Pressable from './MotionPressable';
import { Text, useReducedMotion } from './MotexaVisual';
import { useAppearance } from './Appearance';
import BrandMonogram from './BrandMonogram';
import { RolePhotography } from './RolePhotography';

type Props={
  index?:number;icon:keyof typeof Ionicons.glyphMap;title:string;description?:string;
  selected?:boolean;expanded?:boolean;onPress:()=>void;ar:boolean;variant?:'public'|'admin';
};

/** Shared presentation for the five existing choices and their administrative sub-choices. */
export default function RoleOptionCard({index=0,icon,title,description,selected=false,expanded,onPress,ar,variant='public'}:Props){
  const {dark}=useAppearance();
  const reduced=useReducedMotion();
  const [selection]=useState(()=>new Animated.Value(selected?1:0));
  const [hover]=useState(()=>new Animated.Value(0));
  const administration=variant==='public'&&index===4;
  const hasPhoto=variant==='public';
  const row=ar?'row-reverse' as const:'row' as const;
  const ink=dark?'#FFF1DF':'#432D1E';
  const muted=dark?'#D1B999':'#80654C';
  useEffect(()=>{
    if(reduced){selection.setValue(selected?1:0);return;}
    const animation=Animated.spring(selection,{toValue:selected?1:0,damping:24,stiffness:240,mass:.7,useNativeDriver:true,isInteraction:false});
    animation.start();return()=>animation.stop();
  },[selected,reduced,selection]);
  useEffect(()=>()=>hover.stopAnimation(),[hover]);
  const lift=(active:boolean)=>{
    hover.stopAnimation();
    if(reduced){hover.setValue(0);return;}
    Animated.timing(hover,{toValue:active?1:0,duration:160,useNativeDriver:true,isInteraction:false}).start();
  };
  return <Animated.View style={{width:'100%',marginBottom:12,transform:[{translateY:hover.interpolate({inputRange:[0,1],outputRange:[0,-2]})}]}}>
    <Pressable focusVisibleOnly accessibilityRole={administration?'button':'radio'}
      accessibilityLabel={administration?(ar?'فتح أدوار الإدارة':'Open administration roles'):title}
      accessibilityState={administration?{expanded:!!expanded}:{checked:selected}}
      aria-checked={administration?undefined:selected} aria-expanded={administration?!!expanded:undefined}
      accessibilityHint={administration?(ar?'افتح خيارات الدخول الإداري':'Open administrator sign-in options'):ar?(selected?'اضغط مرة ثانية لإلغاء التحديد':'اضغط لاختيار هذا الدور'):(selected?'Tap again to deselect':'Tap to select this role')}
      onPress={onPress} onHoverIn={()=>lift(true)} onHoverOut={()=>lift(false)}
      style={({pressed})=>[s.card,{flexDirection:row,minHeight:hasPhoto?120:98,
        backgroundColor:dark?(selected?'#4C3524':'#382A21'):(selected?'#F8EAD7':'#FFFAF2'),
        borderColor:selected?(dark?'#C89A66':'#A87847'):(dark?'#70543D':'#E0CCB0'),opacity:pressed?.86:1},variant==='admin'&&{borderWidth:1,borderRadius:38,minHeight:88,backgroundColor:dark?(selected?'#61442DDD':'#35291F88'):(selected?'#EED5B1DD':'#FFFAF288')}]}>
      {hasPhoto?<View style={s.photograph}><RolePhotography index={index} style={StyleSheet.absoluteFill}/><View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:dark?'#30231B18':'transparent'}]}/></View>:<View style={{width:44,height:44,borderRadius:22,backgroundColor:dark?'#59402D':'#F1DEC3',alignItems:'center',justifyContent:'center',margin:16,marginEnd:0}}><Ionicons name={icon} size={22} color={dark?'#E7C59B':'#946A42'}/></View>}
      <BrandMonogram size={variant==='admin'?125:140} style={{left:'30%',top:-12,opacity:variant==='admin'?.035:dark?.035:.045}}/>
      <View style={s.copy}>
        {variant==='public'&&<View style={{flexDirection:row,alignItems:'center',gap:7,marginBottom:5}}>
          <Ionicons name={icon} size={14} color={muted}/>
          <Text style={{fontSize:10,lineHeight:18,letterSpacing:.8,color:muted}}>{String(index+1).padStart(2,'0')}</Text>
        </View>}
        <Text style={{fontSize:16,lineHeight:25,fontWeight:'600',color:ink,textAlign:ar?'right':'left'}}>{title}</Text>
        {!!description&&<Text style={{fontSize:12,lineHeight:21,color:muted,textAlign:ar?'right':'left',marginTop:4}}>{description}</Text>}
      </View>
      <View pointerEvents="none" style={{width:36,alignItems:'center',justifyContent:'center',marginEnd:9}}>
        {administration?<Ionicons name={ar?'chevron-back':'chevron-forward'} size={19} color={muted}/>:<View style={{width:23,height:23,borderRadius:12,borderWidth:1,borderColor:selected?(dark?'#E0B581':'#7D5431'):(dark?'#9A7B5B':'#CEB596'),backgroundColor:selected?(dark?'#E0B581':'#7D5431'):'transparent',alignItems:'center',justifyContent:'center'}}><Animated.View style={{opacity:selection,transform:[{scale:selection.interpolate({inputRange:[0,1],outputRange:[.7,1]})}]}}><Ionicons name="checkmark" size={15} color={dark?'#30231B':'#FFF9EF'}/></Animated.View></View>}
      </View>
      <Animated.View pointerEvents="none" style={{position:'absolute',top:15,bottom:15,[ar?'right':'left']:0,width:3,borderRadius:2,backgroundColor:dark?'#D8AF7F':'#A4784B',opacity:selection}}/>
    </Pressable>
  </Animated.View>;
}
const s=StyleSheet.create({
  card:{width:'100%',borderWidth:1,borderRadius:23,overflow:'hidden',alignItems:'stretch'},
  photograph:{width:'25%',minWidth:64,maxWidth:110,overflow:'hidden',backgroundColor:'#795236'},
  copy:{flex:1,minWidth:0,paddingVertical:14,paddingHorizontal:13},
});
