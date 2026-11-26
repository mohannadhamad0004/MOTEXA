import { View } from "react-native";
import { useAppearance } from "../../components/Appearance";
import { GText, Tabs } from "../../components/garage";
import { Block } from "../../components/manage/Page";
import { useL } from "../../core/hooks/useL";
import { useLanguage } from "../../i18n/LanguageContext";
import { gType, useGarageTheme } from "../../theme/garage";

/** "Appearance & language": language (EN / AR) and theme (light / dark / system), the same segmented control as every other switch.
 *  Applied instantly and saved by the existing providers. */
export function AppearanceSection() {
  const { t } = useL();
  const { align } = useGarageTheme();
  const { language, setLanguage } = useLanguage();
  const { mode, setMode } = useAppearance();
  return (
    <Block title={t("Appearance & language", "المظهر واللغة")}>
      <View style={{ gap: 10, paddingVertical: 10 }}>
        <GText soft style={[gType.caption, align]}>{t("Language", "اللغة")}</GText>
        <Tabs value={language} options={[{ key: "en", label: "English" }, { key: "ar", label: "العربية" }]} onChange={k => setLanguage(k)} />
        <GText soft style={[gType.caption, align]}>{t("Appearance", "المظهر")}</GText>
        <Tabs value={mode} options={[{ key: "light", label: t("Light", "فاتح") }, { key: "dark", label: t("Dark", "داكن") }, { key: "system", label: t("System", "النظام") }]} onChange={k => setMode(k)} />
      </View>
    </Block>
  );
}
