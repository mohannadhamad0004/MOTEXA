import type { ComponentProps, ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { router,type Href } from "expo-router";
import { Text } from "../../../components/ui/Text";
import { Card, EmptyState as GarageEmpty, GButton, GIcon, GText, type GIconName } from "../../../components/garage";
import { gType, useGarageTheme } from "../../../theme/garage";
import { useDT } from "../../department/ui";
import type { PortalSummary,ProviderArea } from "./types";
import { providerLinks,providerPath } from "./navigation";

// Provider pages share the garage kit (Part D layout): Card, Section title, EmptyState and GButton, behind the old names.
export { Pill,useDT } from "../../department/ui";
export { Async,Notice } from "../../../components/ui/Feedback";
export { Text } from "../../../components/ui/Text";

/** Card with an optional title row (icon + title): title, then meta, then action. warn / bad tint the border. */
export function Panel({ children, tone, title, icon }: { children: ReactNode; tone?: "warn" | "bad"; title?: string; icon?: GIconName }) {
  const { g, row, align } = useGarageTheme();
  return (
    <Card style={[{ marginBottom: 14, gap: 4 }, tone ? { borderWidth: 1, borderColor: tone === "bad" ? g.danger : g.warning } : null]}>
      {title ? (
        <View style={[row, { alignItems: "center", gap: 8, marginBottom: 6 }]}>
          {icon ? <GIcon name={icon} size={18} color={g.accentText} /> : null}
          <GText style={[gType.label, align, { flex: 1, fontWeight: "700" }]}>{title}</GText>
        </View>
      ) : null}
      {children}
    </Card>
  );
}

/** Tappable card row: content on the start side, a chevron on the end side when it opens something. */
export function ItemCard({ children, onPress, label }: { children: ReactNode; onPress?: () => void; label: string }) {
  const { g, row } = useGarageTheme();
  return (
    <Card pad={14} onPress={onPress} label={label} style={{ marginBottom: 10 }}>
      <View style={[row, { alignItems: "center", gap: 10 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        {onPress ? <GIcon name="chevron-forward" size={18} color={g.soft} flip /> : null}
      </View>
    </Card>
  );
}

/** Section title (+ optional caption) above a block of cards. */
export function Section({ title, caption }: { title: string; caption?: string }) {
  const { align } = useGarageTheme();
  return (
    <View style={{ marginTop: 8, marginBottom: 12 }}>
      <GText accessibilityRole="header" style={[gType.title, align]}>{title}</GText>
      {caption ? <GText soft style={[gType.caption, align, { marginTop: 2 }]}>{caption}</GText> : null}
    </View>
  );
}

/** Garage Card behind the old ui Card API (11 px gap below, like before). */
export function PCard({ children, onPress, label, style }: { children: ReactNode; onPress?: () => void; label?: string; style?: StyleProp<ViewStyle> }) {
  return <Card onPress={onPress} label={label} style={[{ marginBottom: 11 }, style]}>{children}</Card>;
}

/** Section title between blocks of a long page (old ui SectionHeader API). */
export function SectionHeader({ title }: { title: string }) {
  return <View style={{ marginTop: 16 }}><Section title={title} /></View>;
}

/** The garage empty state (photo + one line); the icon of the old API is not needed any more. */
export function EmptyState({ text }: { icon?: string; text: string }) {
  return <GarageEmpty text={text} />;
}

/** GButton behind the old Button API (loading -> busy, size sm -> 44 px). */
export function Button({ label, onPress, variant = "primary", size, disabled, loading, icon, style }: { label: string; onPress: () => void; variant?: ComponentProps<typeof GButton>["variant"]; size?: "sm" | "md" | "lg"; disabled?: boolean; loading?: boolean; icon?: GIconName; style?: StyleProp<ViewStyle> }) {
  return <GButton label={label} onPress={onPress} variant={variant} disabled={disabled} busy={loading} icon={icon} style={[size === "sm" ? { minHeight: 44, paddingHorizontal: 14 } : null, style]} />;
}

export const go=(path:string)=>router.push(path as Href);
export function MetricGrid({items}:{items:{label:string;value:number|string;path?:string}[]}){const d=useDT();return <View style={{flexDirection:d.row,flexWrap:"wrap",gap:10,marginBottom:18}}>{items.map(x=><View key={x.label} style={{width:"48%",minWidth:0}}><ItemCard label={`${x.label}: ${x.value}`} onPress={x.path?()=>go(x.path!):undefined}><Text style={{fontSize:27,lineHeight:36,fontWeight:"800",color:d.ink,textAlign:d.align}}>{x.value}</Text><Text style={{fontSize:12,lineHeight:19,color:d.muted,textAlign:d.align}}>{x.label}</Text></ItemCard></View>)}</View>;}
export function SectionLinks({area}:{area:ProviderArea}){const d=useDT();return <Panel title={d.t("Your workspace","مساحة عملك")}>{providerLinks[area].filter(x=>x.path).map(n=><Button key={n.path} variant="ghost" label={d.t(n.en,n.ar)} onPress={()=>go(providerPath(area,n.path))} style={{marginBottom:8}}/>)}</Panel>;}
export function RecentActivity({data}:{data:PortalSummary}){const d=useDT();return <Panel title={d.t("Recent activity","آخر النشاطات")}>{data.recent.length?data.recent.map(r=><ItemCard key={r.id} label={r.title} onPress={()=>go(r.kind==="tow"?`/provider/tow/dispatch/${r.id}`:`/provider/parts/orders/${r.id}`)}><Text style={{color:d.ink,textAlign:d.align,fontWeight:"700"}}>{r.title}</Text><Text style={{color:d.muted,textAlign:d.align,fontSize:12,marginTop:6}}>{new Date(r.updatedAt).toLocaleString(d.ar?"ar":"en")}</Text></ItemCard>):<Text style={{color:d.muted,textAlign:d.align}}>{d.t("No recent activity yet.","لا يوجد نشاط حديث بعد.")}</Text>}</Panel>;}
