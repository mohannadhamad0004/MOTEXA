import type {StyleProp,TextStyle} from 'react-native';
import {OwnerIdentity} from './OwnerIdentity';
import {OwnerAppearanceProvider} from './Appearance';
import {createContext,useContext,type ReactNode} from 'react';
import {useFonts} from 'expo-font';
import MechanicType from './MechanicType';
import {Text} from './MotexaVisual';
import {useMechanicTheme} from './MechanicUI';
const Ready=createContext(false);
export default function CustomerType({children}:{children:ReactNode}){const [ready]=useFonts({CustomerEditorial:require('../../assets/fonts/GreatVibes-Regular.ttf'),CustomerEditorialArabic:require('../../assets/fonts/Cairo-SemiBold.ttf')});return <OwnerAppearanceProvider><OwnerIdentity.Provider value={true}><MechanicType><Ready.Provider value={ready}>{children}</Ready.Provider></MechanicType></OwnerIdentity.Provider></OwnerAppearanceProvider>;}
export function CustomerTitle({en,ar}:{en:string;ar:string}){const m=useMechanicTheme(),ready=useContext(Ready);return <Text accessibilityRole="header" style={{fontFamily:ready?(m.ar?'CustomerEditorialArabic':'CustomerEditorial'):undefined,fontSize:m.ar?28:40,lineHeight:m.ar?45:51,color:m.ink,textAlign:m.align}}>{m.t(en,ar)}</Text>;}

/** The existing project greeting type, shared only by owner screens. */
export function OwnerEditorial({children,style,numberOfLines,adjustsFontSizeToFit=false}:{children:ReactNode;style?:StyleProp<TextStyle>;numberOfLines?:number;adjustsFontSizeToFit?:boolean}){const m=useMechanicTheme(),ready=useContext(Ready);return <Text accessibilityRole="header" numberOfLines={numberOfLines} adjustsFontSizeToFit={adjustsFontSizeToFit} minimumFontScale={.72} style={[{fontFamily:ready?(m.ar?'CustomerEditorialArabic':'CustomerEditorial'):undefined,fontSize:m.ar?28:38,lineHeight:m.ar?45:49,fontWeight:'400',letterSpacing:0,color:m.ink,textAlign:m.align},style]}>{children}</Text>;}
