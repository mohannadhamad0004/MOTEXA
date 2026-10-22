import { ReactNode, useState } from "react";
import { DrawingKind, HeroIconButton, SettingsSheet, SimplePage } from "../blueprint";
import { useL } from "../../core/hooks/useL";

// Area of the app -> the drawing and the tag in the compact hero.
const AREAS: Record<string, { kind: DrawingKind; tag: string }> = {
  "MOTEXA TOW": { kind: "tow", tag: "FLEET / T1" },
  "MOTEXA PARTS": { kind: "shop", tag: "INVENTORY / P1" },
  "MOTEXA ADMIN": { kind: "toolbox", tag: "ADMIN / A1" },
  MOTEXA: { kind: "toolbox", tag: "MOTEXA / M1" },
};

/**
 * The usual provider / admin / mechanic page: compact hero (150px, one drawing, a tag, a small settings icon that
 * opens language + appearance) and a dense sheet below with a 26px title. Replaces the old header with switches.
 */
export function DashboardLayout({
  brand = "MOTEXA",
  title,
  subtitle,
  back,
  signOutButton,
  onRefresh,
  refreshing,
  kind,
  tag,
  tr,
  children,
}: {
  brand?: string;
  title: string;
  subtitle?: string;
  back?: boolean;
  signOutButton?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  kind?: DrawingKind;
  tag?: string;
  tr?: string;
  children: ReactNode;
}) {
  const { t } = useL();
  const [open, setOpen] = useState(false);
  const area = AREAS[brand] ?? AREAS.MOTEXA;
  return (
    <>
      <SimplePage
        dense
        kind={kind ?? area.kind}
        tl={tag ?? area.tag}
        tr={tr}
        title={title}
        sub={subtitle}
        back={back ? "/" : undefined}
        right={<HeroIconButton icon="settings" label={t("Settings", "الإعدادات")} onPress={() => setOpen(true)} />}
        onRefresh={onRefresh}
        refreshing={refreshing}
      >
        {children}
      </SimplePage>
      <SettingsSheet visible={open} onClose={() => setOpen(false)} signOutButton={signOutButton} />
    </>
  );
}
