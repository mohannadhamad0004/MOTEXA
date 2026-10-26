import { AppearanceProvider } from "../components/Appearance";
import { VisualProvider } from "../components/MotexaVisual";
import { Stack } from "expo-router";
import {useReducedMotion} from "../components/MotexaVisual";
import {useAppearance} from "../components/Appearance";
import {useLanguage} from "../i18n/LanguageContext";
import { LanguageProvider } from "../i18n/LanguageContext";

export default function RootLayout() {
  return (
    <AppearanceProvider><LanguageProvider><VisualProvider>
      <AppNavigator/>
    </VisualProvider></LanguageProvider></AppearanceProvider>
  );
}
function AppNavigator(){const reduced=useReducedMotion();const {dark}=useAppearance();const {isArabic}=useLanguage();return <Stack screenOptions={{headerShown:false,animation:reduced?'none':isArabic?'slide_from_left':'slide_from_right',contentStyle:{backgroundColor:dark?'#211B17':'#FFF9EF'}}}/>;}
