import {useFonts} from 'expo-font';
import {createContext,useContext,type ReactNode} from 'react';
import {TypefaceProvider} from './MotexaVisual';

const Ready=createContext(false);
export const useMechanicFonts=()=>useContext(Ready);

/** Typography is scoped to the mechanic workspace; MOTEXA's wordmark is unchanged. */
export default function MechanicType({children}:{children:ReactNode}){
 const [ready]=useFonts({
  MechanicLatin:require('../../assets/fonts/Manrope-Regular.ttf'),
  MechanicLatinMedium:require('../../assets/fonts/Manrope-SemiBold.ttf'),
  MechanicLatinBold:require('../../assets/fonts/Manrope-Bold.ttf'),
  MechanicArabic:require('../../assets/fonts/Cairo-Regular.ttf'),
  MechanicArabicMedium:require('../../assets/fonts/Cairo-SemiBold.ttf'),
  MechanicArabicBold:require('../../assets/fonts/Cairo-Bold.ttf'),
  MechanicEditorial:require('../../assets/fonts/GFSDidot-Regular.ttf'),
 });
 return <Ready.Provider value={ready}><TypefaceProvider value={ready?{regular:'MechanicLatin',medium:'MechanicLatinMedium',bold:'MechanicLatinBold',arabic:'MechanicArabic',arabicMedium:'MechanicArabicMedium',arabicBold:'MechanicArabicBold'}:null}>{children}</TypefaceProvider></Ready.Provider>;
}
