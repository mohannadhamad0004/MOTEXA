import {useId} from 'react';
import {Image,View,type ImageSourcePropType} from 'react-native';
import Animated,{useAnimatedStyle,useAnimatedProps,interpolate,Extrapolation,type SharedValue} from 'react-native-reanimated';
import Svg,{Defs,ClipPath,Path,Image as SvgImage} from 'react-native-svg';
const AnimatedPath=Animated.createAnimatedComponent(Path);

/** Photographic chapter reveal. Matching model/photographer, not a 3D camera or one continuous recording. */
export function VehiclePhotoReveal({progress,width,height}:{progress:SharedValue<number>;width:number;height:number}){
 const id='cockpit'+useId().replace(/[^a-zA-Z0-9]/g,'');
 const outside=useAnimatedStyle(()=>({transform:[{scale:interpolate(progress.value,[0,.7,1],[1.15,1.08,1],Extrapolation.CLAMP)},{translateX:interpolate(progress.value,[0,1],[15,0],Extrapolation.CLAMP)}]}));
 const cockpitMask=useAnimatedProps(()=>{
  const t=interpolate(progress.value,[.28,.82],[0,1],Extrapolation.CLAMP),close=interpolate(progress.value,[.82,.98],[0,1],Extrapolation.CLAMP),cx=width*.40,cy=height*.49;
  const x1=(width*.18*t)*(1-close)+cx*close,y1=height*.46*t*(1-close)+cy*close;
  const x2=(width*(1-.42*t))*(1-close)+cx*close,y2=height*.44*t*(1-close)+cy*close;
  const x3=(width*(1-.40*t))*(1-close)+cx*close,y3=height*(1-.45*t)*(1-close)+cy*close;
  const x4=(width*.18*t)*(1-close)+cx*close,y4=height*(1-.46*t)*(1-close)+cy*close;
  return {d:`M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`};
 });
 const dashboard=useAnimatedStyle(()=>{
  const t=interpolate(progress.value,[0,.28],[0,1],Extrapolation.CLAMP),close=interpolate(progress.value,[.24,.34],[1,0],Extrapolation.CLAMP);
  return {left:width*.03*t,top:height*.27*t,width:width*(1-.58*t),height:height*(1-.74*t)*close,borderRadius:12*t};
 });
 return <View pointerEvents="none" style={{position:'absolute',inset:0,backgroundColor:'#17120F'}}>
  <Animated.View testID="owner-photo-exterior" style={[{position:'absolute',left:-width*.15,top:height*.27,width:width*1.3,height:width*1.3*2/3},outside]}><Image accessible={false} source={require('../../assets/images/owner-real-r8-exterior-v16.jpg')} resizeMode="cover" style={{width:'100%',height:'100%'}}/></Animated.View>
  <Svg testID="owner-photo-cockpit" width={width} height={height} style={{position:'absolute',inset:0}}><Defs><ClipPath id={id}><AnimatedPath testID="owner-cockpit-aperture" animatedProps={cockpitMask}/></ClipPath></Defs><SvgImage href={require('../../assets/images/owner-real-r8-cockpit-v16.jpg')} x={0} y={0} width={width} height={height} preserveAspectRatio="xMidYMid slice" clipPath={'url(#'+id+')'}/></Svg>
  <Animated.View testID="owner-photo-dashboard" style={[{position:'absolute',overflow:'hidden'},dashboard]}><Image accessible={false} source={require('../../assets/images/owner-real-r8-dashboard-v16.jpg')} resizeMode="cover" style={{width:'100%',height:'100%'}}/></Animated.View>
 </View>;
}

export function PhotoChapterLayer({progress,start,width,height,source}:{progress:SharedValue<number>;start:number;width:number;height:number;source:ImageSourcePropType}){
 const curtain=useAnimatedStyle(()=>({transform:[{translateX:interpolate(progress.value,[start-.28,start+.08],[width,0],Extrapolation.CLAMP)}]}));
 const photo=useAnimatedStyle(()=>({transform:[{translateX:interpolate(progress.value,[start-.28,start+.08],[-width,0],Extrapolation.CLAMP)},{scale:interpolate(progress.value,[start-.28,start+1],[1.10,1],Extrapolation.CLAMP)}]}));
 return <Animated.View pointerEvents="none" testID={'owner-service-curtain-'+start} style={[{position:'absolute',inset:0,overflow:'hidden',backgroundColor:'#17120F'},curtain]}><Animated.View style={[{width,height},photo]}><Image accessible={false} source={source} resizeMode="cover" style={{width:'100%',height:'100%'}}/></Animated.View></Animated.View>;
}

