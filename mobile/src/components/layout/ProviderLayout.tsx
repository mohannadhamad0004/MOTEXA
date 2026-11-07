import { createContext, isValidElement, type ReactNode, type Ref, useContext, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router, usePathname, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../ui/Text";
import { SettingsSheet } from "../blueprint";
import { ProviderHeader } from "./ProviderHeader";
import { useDT, Pill } from "../../features/department/ui";
import { useGarageTheme } from "../../theme/garage";
import { providerLinks, providerPath } from "../../features/provider/portal/navigation";
import type { ProviderArea } from "../../features/provider/portal/types";

/** Set by the provider tab screens (features/providerhub): inside the tab shell the frame drops its own link chips and back row. */
/** 0 = stand-alone page, 1 = inside the tab shell, 2 = inside the shell below its own top row (no safe-area padding again) */
export const InTabs=createContext<0|1|2>(0);

/** Context-free provider frame using the department palette and card hierarchy. */
export function ProviderLayout({children,area:given,title,subtitle,hero,bottom,onRefresh,refreshing,scroll=true,scrollRef}: {
  /** lets a screen scroll itself (e.g. to the first problem of a form) */
  scrollRef?:Ref<ScrollView>;
  children:ReactNode;area?:ProviderArea;title?:string;subtitle?:string;hero?:ReactNode;bottom?:ReactNode;onRefresh?:()=>void;refreshing?:boolean;scroll?:boolean;
  tag?:string;tr?:string;kind?:string;brand?:string;back?:boolean;signOutButton?:boolean;tabs?:boolean;entry?:string;overlap?:number;
}){
  const d=useDT(),insets=useSafeAreaInsets(),path=usePathname(),area=given??(path.includes("/parts")?"parts":"tow"),base=providerPath(area);
  const [settings,setSettings]=useState(false),tabbed=useContext(InTabs),{g}=useGarageTheme();
  const h=isValidElement(hero)?hero.props as {title?:string;line?:string;onBack?:()=>void;children?:ReactNode;action?:{label:string;onPress:()=>void}}:{};
  const button=(label:string,onPress:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{minHeight:44,justifyContent:"center",paddingHorizontal:10}}><Text style={{color:d.accent,fontWeight:"700",textAlign:d.align}}>{label}</Text></Pressable>;
  const head=<>
    <ProviderHeader onBack={!tabbed&&path!==base?()=>h.onBack?h.onBack():router.canGoBack()?router.back():router.navigate(base as Href):undefined} onSettings={()=>setSettings(true)}/>
    <View style={{paddingVertical:18,gap:8}}>
      <Pill tone="bronze" label={area==="tow"?d.t("TOWING / PROVIDER","السحب / مقدم الخدمة"):d.t("PARTS / SHOP","قطع الغيار / المتجر")} />
      <Text accessibilityRole="header" style={{fontSize:28,lineHeight:d.ar?42:36,fontWeight:"800",color:d.ink,textAlign:d.align}}>{title??h.title??d.t("Dashboard","لوحة التحكم")}</Text>
      {subtitle??h.line?<Text style={{fontSize:13,lineHeight:21,color:d.muted,textAlign:d.align}}>{subtitle??h.line}</Text>:null}
      {h.children}
      {h.action?button(h.action.label,h.action.onPress):null}
    </View>
    {tabbed?null:<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{flexDirection:d.row,gap:8,paddingBottom:16}}>
      {providerLinks[area].map(n=>{const target=providerPath(area,n.path),on=path===target;return <Pressable key={n.path} accessibilityRole="button" accessibilityState={{selected:on}} onPress={()=>router.navigate(target as Href)} style={{minHeight:44,justifyContent:"center",paddingHorizontal:14,borderRadius:22,borderWidth:1,borderColor:on?d.fill:d.border,backgroundColor:on?d.fill:d.surface}}><Text style={{color:on?d.fillInk:d.ink,fontSize:12,fontWeight:"700"}}>{d.t(n.en,n.ar)}</Text></Pressable>;})}
    </ScrollView>}
  </>;
  return <View style={{flex:1,backgroundColor:tabbed?g.page:d.paper,paddingTop:tabbed===2?0:insets.top}}>
    {scroll?<ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" refreshControl={onRefresh?<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh}/>:undefined} contentContainerStyle={{width:"100%",maxWidth:760,alignSelf:"center",paddingHorizontal:18,paddingBottom:insets.bottom+(tabbed?130:40)}}>{head}{children}</ScrollView>:<View style={{flex:1,paddingHorizontal:18}}>{head}{children}</View>}
    {bottom}
    <SettingsSheet visible={settings} onClose={()=>setSettings(false)} signOutButton />
  </View>;
}
