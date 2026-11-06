import { View } from "react-native";
import { router,type Href } from "expo-router";
import { Text } from "../../../components/ui/Text";
import { Button } from "../../../components/ui/Button";
import { useDT,Panel,ItemCard } from "../../department/ui";
import type { PortalSummary,ProviderArea } from "./types";
import { providerLinks,providerPath } from "./navigation";

export { Panel,ItemCard,Pill,Section,useDT } from "../../department/ui";
export { Async,Notice,EmptyState } from "../../../components/ui/Feedback";
export { Text } from "../../../components/ui/Text";
export { Button } from "../../../components/ui/Button";
export const go=(path:string)=>router.push(path as Href);
export function MetricGrid({items}:{items:{label:string;value:number|string;path?:string}[]}){const d=useDT();return <View style={{flexDirection:d.row,flexWrap:"wrap",gap:10,marginBottom:18}}>{items.map(x=><View key={x.label} style={{width:"48%",minWidth:0}}><ItemCard label={`${x.label}: ${x.value}`} onPress={x.path?()=>go(x.path!):undefined}><Text style={{fontSize:27,lineHeight:36,fontWeight:"800",color:d.ink,textAlign:d.align}}>{x.value}</Text><Text style={{fontSize:12,lineHeight:19,color:d.muted,textAlign:d.align}}>{x.label}</Text></ItemCard></View>)}</View>;}
export function SectionLinks({area}:{area:ProviderArea}){const d=useDT();return <Panel title={d.t("Your workspace","مساحة عملك")}>{providerLinks[area].filter(x=>x.path).map(n=><Button key={n.path} variant="ghost" label={d.t(n.en,n.ar)} onPress={()=>go(providerPath(area,n.path))} style={{marginBottom:8}}/>)}</Panel>;}
export function RecentActivity({data}:{data:PortalSummary}){const d=useDT();return <Panel title={d.t("Recent activity","آخر النشاطات")}>{data.recent.length?data.recent.map(r=><ItemCard key={r.id} label={r.title} onPress={()=>go(r.kind==="tow"?`/provider/tow/dispatch/${r.id}`:`/provider/parts/orders/${r.id}`)}><Text style={{color:d.ink,textAlign:d.align,fontWeight:"700"}}>{r.title}</Text><Text style={{color:d.muted,textAlign:d.align,fontSize:12,marginTop:6}}>{new Date(r.updatedAt).toLocaleString(d.ar?"ar":"en")}</Text></ItemCard>):<Text style={{color:d.muted,textAlign:d.align}}>{d.t("No recent activity yet.","لا يوجد نشاط حديث بعد.")}</Text>}</Panel>;}
