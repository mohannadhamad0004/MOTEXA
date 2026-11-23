import {useId} from 'react';
import Svg,{Defs,RadialGradient,LinearGradient,Stop,Rect,Ellipse,Path} from 'react-native-svg';

/** A quiet studio horizon shared by the owner vehicle presentation. */
export default function OwnerStudioLighting(){
 const id='studio'+useId().replace(/[^a-zA-Z0-9]/g,'');
 return <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 420 320" preserveAspectRatio="none" style={{position:'absolute',inset:0}}>
  <Defs>
   <RadialGradient id={id+'light'} cx="48%" cy="55%" rx="65%" ry="60%"><Stop offset="0" stopColor="#8E7358" stopOpacity=".34"/><Stop offset=".65" stopColor="#44372D" stopOpacity=".18"/><Stop offset="1" stopColor="#17120F" stopOpacity="0"/></RadialGradient>
   <LinearGradient id={id+'floor'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#D0B28C" stopOpacity=".12"/><Stop offset="1" stopColor="#17120F" stopOpacity="0"/></LinearGradient>
  </Defs>
  <Rect width="420" height="320" fill={'url(#'+id+'light)'}/>
  <Path d="M0 222 Q210 202 420 222 L420 320 L0 320Z" fill={'url(#'+id+'floor)'}/>
  <Path d="M-20 223 Q210 195 440 223" fill="none" stroke="#E5C69E" strokeOpacity=".15" strokeWidth=".7"/>
  <Ellipse cx="210" cy="252" rx="161" ry="17" fill="#000" opacity=".35"/>
 </Svg>;
}
