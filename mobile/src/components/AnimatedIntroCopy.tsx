import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Text, useReducedMotion } from './MotexaVisual';

/** Animate whole words so Arabic letters stay joined and the sentence remains accessible. */
export default function AnimatedIntroCopy({text,arabic,fontFamily,color}:{text:string;arabic:boolean;fontFamily?:string;color:string}) {
  const reduced=useReducedMotion();
  const [progress]=useState(()=>new Animated.Value(1));
  const words=text.split(/\s+/);
  useEffect(()=>{
    if(reduced){progress.setValue(1);return;}
    progress.setValue(0);
    const animation=Animated.timing(progress,{toValue:1,duration:680,delay:90,easing:Easing.linear,useNativeDriver:true,isInteraction:false});
    animation.start();return()=>animation.stop();
  },[progress,reduced,text]);
  return <View testID="launch-description" accessible accessibilityLabel={text} style={{marginTop:13,flexDirection:arabic?'row-reverse':'row',flexWrap:'wrap',columnGap:4,rowGap:1}}>
    {words.map((word,index)=>{
      const start=words.length>1?(index/(words.length-1))*.62:0;
      const opacity=progress.interpolate({inputRange:[start,Math.min(1,start+.38)],outputRange:[0,1],extrapolate:'clamp'});
      return <Animated.View key={index+'-'+word} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{opacity,transform:[{translateY:progress.interpolate({inputRange:[start,Math.min(1,start+.38)],outputRange:[7,0],extrapolate:'clamp'})}]}}>
        <Text style={{fontFamily,fontSize:14,lineHeight:25,color,writingDirection:arabic?'rtl':'ltr'}}>{word}</Text>
      </Animated.View>;
    })}
  </View>;
}
