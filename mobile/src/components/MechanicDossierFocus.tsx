import {useEffect,useRef,type ReactNode} from 'react';
import {Modal,View,ScrollView,Platform,useWindowDimensions,type ViewStyle} from 'react-native';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,Easing} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BrandHeader from './BrandHeader';
import {useReducedMotion} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';

/** A real application dossier in a focused surface; no preview data or duplicated actions. */
export default function MechanicDossierFocus({visible,section,targetOffset,busy,onClose,children}:{visible:boolean;section:string;targetOffset?:number;busy:boolean;onClose:()=>void;children:ReactNode}){
 const m=useMechanicTheme(),reduced=useReducedMotion(),insets=useSafeAreaInsets(),{height,width}=useWindowDimensions();
 const scroll=useRef<ScrollView>(null),lastSection=useRef<string|null>(null),progress=useSharedValue(1);
 useEffect(()=>{if(!visible)return;progress.value=reduced?1:0;progress.value=withTiming(1,{duration:reduced?0:260,easing:Easing.out(Easing.cubic)});},[visible,reduced,progress]);
 useEffect(()=>{if(!visible){lastSection.current=null;return;}if(lastSection.current===section)return;const first=lastSection.current===null;lastSection.current=section;scroll.current?.scrollTo({y:first||section==='profile'?0:Math.max(0,(targetOffset??0)-100),animated:!first&&!reduced});},[visible,section,targetOffset,reduced]);
 const entrance=useAnimatedStyle(()=>({opacity:progress.value,transform:[{scale:.975+.025*progress.value},{translateY:12*(1-progress.value)}]}));
 const scrollStyle:ViewStyle&{scrollbarWidth?:'thin';scrollbarColor?:string;overscrollBehavior?:string}=Platform.OS==='web'?{scrollbarWidth:'thin',scrollbarColor:m.dark?'#B29470 transparent':'#B99468 transparent',overscrollBehavior:'contain'}:{};
 const close=()=>{if(!busy)onClose();};
 return <Modal transparent visible={visible} animationType="none" onRequestClose={close} statusBarTranslucent><View style={{flex:1,backgroundColor:m.dark?'#130F0DEB':'#302319BA',paddingTop:insets.top+10,paddingBottom:insets.bottom+10,paddingHorizontal:width<370?7:13,alignItems:'center',justifyContent:'center'}}>
  <Animated.View testID="mechanic-dossier-focus" accessibilityViewIsModal style={[{width:'100%',maxWidth:920,height:Math.max(240,Math.min(height-insets.top-insets.bottom-24,930)),maxHeight:'100%',borderRadius:width<370?25:31,borderWidth:1,borderColor:m.dark?'#967A57':'#F4DEC0',overflow:'hidden',backgroundColor:m.dark?'#30231B':'#FFF7EB',boxShadow:'0px 14px 48px rgba(28,17,10,0.22)'},entrance]}>
   <View style={{borderBottomWidth:1,borderColor:m.border,paddingTop:3}}><BrandHeader onBack={close} backLabel={m.t('Back to applications','العودة للطلبات')} backDisabled={busy}/></View>
   <ScrollView ref={scroll} style={[{flex:1},scrollStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator nestedScrollEnabled contentContainerStyle={{padding:width<370?11:16,paddingBottom:30}}>{children}</ScrollView>
  </Animated.View>
 </View></Modal>;
}
