import { AppearanceProvider } from "../components/Appearance";
import { VisualProvider } from "../components/MotexaVisual";
import { Stack } from "expo-router";
import { LanguageProvider } from "../i18n/LanguageContext";

export default function RootLayout() {
  return (
    <AppearanceProvider><LanguageProvider><VisualProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </VisualProvider></LanguageProvider></AppearanceProvider>
  );
}