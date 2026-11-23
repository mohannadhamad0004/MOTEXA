import {useEffect,useMemo,useRef,type ReactNode} from 'react';
import {View,KeyboardAvoidingView,Platform,RefreshControl,type ScrollView} from 'react-native';
import Animated,{useSharedValue,useAnimatedScrollHandler} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BrandHeader from './BrandHeader';
import {useMechanicTheme} from './MechanicUI';
import {OwnerMotionContext} from './OwnerMotion';

/** Owner-only native scroll host. Shared mechanic/admin layouts are not changed. */
export default function OwnerWorkspacePage({children,footer,backdrop,contentOverlay,onRefresh,refreshing=false,scrollKey}:{children:ReactNode;title?:string;presentation?:'workspace';footer?:ReactNode;backdrop?:ReactNode;contentOverlay?:ReactNode;onRefresh?:()=>void;refreshing?:boolean;scrollKey?:string}){
 const m=useMechanicTheme(),insets=useSafeAreaInsets(),scroll=useSharedValue(0),ref=useRef<ScrollView>(null);
 const handler=useAnimatedScrollHandler(e=>{scroll.value=Math.max(0,e.contentOffset.y);});
 const motion=useMemo(()=>({scroll,scrollTo:(y:number,animated=true)=>ref.current?.scrollTo({y:Math.max(0,y),animated})}),[scroll]);
 useEffect(()=>{scroll.set(0);ref.current?.scrollTo({y:0,animated:false});},[scrollKey,scroll]);
 return <OwnerMotionContext.Provider value={motion}><View style={{flex:1,backgroundColor:m.canvas}}>{backdrop}<KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
  <Animated.ScrollView ref={ref} onScroll={handler} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} refreshControl={onRefresh&&Platform.OS!=='web'?<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[m.muted]} tintColor={m.muted} progressBackgroundColor={m.surface}/>:undefined} contentContainerStyle={{paddingHorizontal:18,paddingTop:insets.top+9,paddingBottom:footer?24:insets.bottom+28,width:'100%',maxWidth:520,alignSelf:'center'}}>
   <View style={{marginHorizontal:-6}}><BrandHeader/></View>{children}
  </Animated.ScrollView>
 </KeyboardAvoidingView>{contentOverlay}{footer&&<View pointerEvents="box-none" style={{zIndex:contentOverlay?30:undefined,paddingHorizontal:18,paddingTop:5,paddingBottom:Math.max(insets.bottom,18),width:'100%',maxWidth:520,alignSelf:'center'}}>{footer}</View>}</View></OwnerMotionContext.Provider>;
}
