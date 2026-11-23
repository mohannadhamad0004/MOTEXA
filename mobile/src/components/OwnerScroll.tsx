import {createContext,useContext,type ReactNode} from 'react';
import {Animated as LegacyAnimated} from 'react-native';
import Animated,{useSharedValue,useAnimatedStyle,interpolate,Extrapolation} from 'react-native-reanimated';
import {useReducedMotion} from './MotexaVisual';
import {OwnerMotionContext} from './OwnerMotion';

// Compatibility for owner presentations rendered outside the authenticated workspace.
export const OwnerScrollProvider=createContext<LegacyAnimated.Value|null>(null).Provider;
function useScroll(){const context=useContext(OwnerMotionContext),fallback=useSharedValue(0);return context?.scroll||fallback;}
export function OwnerScrollScene({children,range=450}:{children:ReactNode;range?:number}){const v=useScroll(),reduced=useReducedMotion(),style=useAnimatedStyle(()=>({transform:reduced?[]:[{translateY:interpolate(v.value,[0,range],[0,-17],Extrapolation.CLAMP)},{scale:interpolate(v.value,[0,range],[1,.96],Extrapolation.CLAMP)}]}));return <Animated.View testID="owner-scroll-scene" style={style}>{children}</Animated.View>;}
export function OwnerScrollReveal({children,start=0,enabled=true}:{children:ReactNode;start?:number;enabled?:boolean}){const v=useScroll(),reduced=useReducedMotion(),style=useAnimatedStyle(()=>({transform:reduced||!enabled?[]:[{translateY:interpolate(v.value,[start,start+600],[26,-18],Extrapolation.CLAMP)},{scale:interpolate(v.value,[start,start+600],[1.04,1],Extrapolation.CLAMP)}]}));return <Animated.View testID="owner-scroll-reveal" style={style}>{children}</Animated.View>;}
export function OwnerVehicleMotion({children,enabled=true}:{children:ReactNode;enabled?:boolean}){const v=useScroll(),reduced=useReducedMotion(),style=useAnimatedStyle(()=>({transform:reduced||!enabled?[]:[{perspective:1000},{translateY:interpolate(v.value,[0,400],[0,-26],Extrapolation.CLAMP)},{scale:interpolate(v.value,[0,400],[1,1.08],Extrapolation.CLAMP)}]}));return <Animated.View testID="owner-vehicle-motion" style={style}>{children}</Animated.View>;}
