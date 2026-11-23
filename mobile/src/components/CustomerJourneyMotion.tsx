import {useEffect,type ReactNode} from 'react';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,cancelAnimation,Easing,ReduceMotion} from 'react-native-reanimated';
import {useLanguage} from '../i18n/LanguageContext';

/** Owner screens share one short, directional transition; controls never wait for it. */
export default function CustomerJourneyMotion({children}:{children:ReactNode}){
 const {isArabic}=useLanguage(),progress=useSharedValue(0);
 useEffect(()=>{progress.set(withTiming(1,{duration:260,easing:Easing.out(Easing.cubic),reduceMotion:ReduceMotion.System}));return()=>cancelAnimation(progress);},[progress]);
 const style=useAnimatedStyle(()=>({opacity:progress.value,transform:[{translateX:(isArabic?-1:1)*(1-progress.value)*13}]}));
 return <Animated.View testID="owner-screen-transition" style={style}>{children}</Animated.View>;
}
