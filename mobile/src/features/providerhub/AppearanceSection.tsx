import { Card, Section } from "../../components/garage";
import { SettingsControls } from "../../components/blueprint";
import { useL } from "../../core/hooks/useL";

/** "Appearance & language": language (EN/AR) and theme (light/dark/system). Applied instantly, saved by the existing providers. */
export function AppearanceSection() {
  const { t } = useL();
  return (
    <Section title={t("Appearance & language", "المظهر واللغة")}>
      <Card pad={12}>
        <SettingsControls />
      </Card>
    </Section>
  );
}
