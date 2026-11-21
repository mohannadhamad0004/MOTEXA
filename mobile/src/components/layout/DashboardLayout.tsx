import { ReactNode } from "react";
import { router } from "expo-router";
import { useWindowDimensions } from "react-native";
import { GaragePage, GarageHero } from "../garage";
import { MoHero, MoHeroName } from "../garage/MoHero";
import { useL } from "../../core/hooks/useL";

/**
 * The usual provider / admin / mechanic detail page on the garage kit: plain header (back button, title, subtitle) and,
 * when `hero` is given and its files exist in assets/mo, Mo's header video under the title. Language and theme live in Profile.
 */
export function DashboardLayout({
  title,
  subtitle,
  back,
  onRefresh,
  refreshing,
  hero,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  hero?: MoHeroName;
  children: ReactNode;
}) {
  const { t } = useL();
  const { width } = useWindowDimensions();
  return (
    <GaragePage
      onRefresh={onRefresh}
      refreshing={refreshing}
      hero={
        <GarageHero
          variant="detail"
          title={title}
          line={subtitle}
          onBack={back ? () => (router.canGoBack() ? router.back() : router.replace("/")) : undefined}
          backLabel={t("Back", "رجوع")}
          banner={hero ? <MoHero name={hero} width={Math.min(width, 680) - 40} label={t("Mo, the MOTEXA mascot", "مو، تميمة موتيكسا")} /> : undefined}
        />
      }
    >
      {children}
    </GaragePage>
  );
}
