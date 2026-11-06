import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SettingsSheet } from "../../components/blueprint";
import { Card, ErrorState, GaragePage, GText, HeroLayout, ListRow, Section, SkeletonRows } from "../../components/garage";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useSessionUser } from "../../core/session/session";
import { gType, useGarageTheme } from "../../theme/garage";
import { portalApi } from "../provider/portal/api";
import type { ProviderArea } from "../provider/portal/types";
import { HUB, linkLabel } from "./hub";

const go = (p: string) => router.push(p as Href);

/** Home of both provider roles: Garage hero (Mo clip), the real numbers, then every other screen as a row. */
export function ProviderHome({ area }: { area: ProviderArea }) {
  const cfg = HUB[area];
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const user = useSessionUser();
  const state = useLoad(() => portalApi.summary(area), [user.id]);
  const [settings, setSettings] = useState(false);
  const m = state.data?.metrics;
  return (
    <>
      <GaragePage
        tabs
        entry={`provider-${area}`}
        refreshing={state.loading && !!state.data}
        onRefresh={state.reload}
        hero={
          <HeroLayout
            config={{
              tab: cfg.hero,
              title: state.data?.identity.name ?? t(cfg.eyebrow.en, cfg.eyebrow.ar),
              line: (m && cfg.line(m, t)) || undefined,
              action: { kind: "button", label: t(cfg.action.en, cfg.action.ar), icon: cfg.action.icon, onPress: () => go(cfg.action.path) },
              top: { label: t(cfg.eyebrow.en, cfg.eyebrow.ar), actions: [{ icon: "settings-outline", label: t("Settings", "الإعدادات"), onPress: () => setSettings(true) }] },
            }}
          />
        }
      >
        {state.error && !state.data ? (
          <ErrorState text={t("Could not load your numbers.", "تعذّر تحميل الأرقام.")} onRetry={state.reload} />
        ) : !m ? (
          <SkeletonRows count={4} />
        ) : (
          <View style={[row, { flexWrap: "wrap", gap: 12 }]}>
            {cfg.stats.map((s) => (
              <Card key={s.en} label={`${t(s.en, s.ar)}: ${s.value(m)}`} onPress={() => go(s.path)} style={{ width: "47.5%" }}>
                <GText style={[gType.display, align, { color: s.warn && s.value(m) > 0 ? g.warning : g.ink }]}>{String(s.value(m))}</GText>
                <GText soft style={[gType.caption, align]}>{t(s.en, s.ar)}</GText>
              </Card>
            ))}
          </View>
        )}
        <Section title={t("Your workspace", "مساحة عملك")}>
          <Card pad={8}>
            {cfg.more.map((x, i) => {
              const l = linkLabel(area, x.path);
              return <ListRow key={x.path} icon={x.icon} title={isArabic ? l.ar : l.en} divider={i > 0} onPress={() => go(`/provider/${area}/${x.path}`)} />;
            })}
          </Card>
        </Section>
      </GaragePage>
      <SettingsSheet visible={settings} onClose={() => setSettings(false)} signOutButton />
    </>
  );
}
