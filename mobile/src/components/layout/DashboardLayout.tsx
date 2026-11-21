import { ReactNode } from "react";
import { router } from "expo-router";
import { GaragePage, GarageHero, HeroLayout } from "../garage";
import { ToastHost } from "../ItemActionsMenu";
import { moHeroMedia, MoHeroName } from "../garage/MoHero";
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
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <>
    <GaragePage
      onRefresh={onRefresh}
      refreshing={refreshing}
      hero={
        hero ? (
          <HeroLayout
            config={{
              tab: "mechanics",
              title,
              line: subtitle,
              top: { label: t("Mechanic", "ميكانيكي"), back: back ? goBack : undefined, actions: [] },
              media: moHeroMedia(hero, t("Mo, the MOTEXA mascot", "مو، تميمة موتيكسا")),
            }}
          />
        ) : (
          <GarageHero variant="detail" title={title} line={subtitle} onBack={back ? goBack : undefined} backLabel={t("Back", "رجوع")} />
        )
      }
    >
      {children}
    </GaragePage>
    <ToastHost />
    </>
  );
}
