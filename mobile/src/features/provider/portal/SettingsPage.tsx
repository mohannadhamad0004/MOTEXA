import { useState } from "react";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { AppearanceSection } from "../../providerhub/AppearanceSection";
import type { ProviderArea } from "./types";
import { useLoad } from "../../../core/hooks/useLoad";
import { api } from "../../shared/api";
import { Panel,Button,useDT,go } from "./ui";
// the owner only sees the driver link when he is also a driver (a company driver row with isOwner)
export default function SettingsPage({area}:{area:ProviderArea}){const d=useDT(),isDriver=useLoad(()=>area==="tow"?api<{drivers:{isOwner:boolean}[]}>("GET","/tow/me/drivers").then(r=>r.drivers.some(x=>x.isOwner),()=>false):Promise.resolve(false),[area]);; return <ProviderLayout area={area} title={d.t("Settings","الإعدادات")}><AppearanceSection/><Panel><Button variant="ghost" label={d.t("Business profile","ملف النشاط")} onPress={()=>go(`/provider/${area}/${area==="tow"?"company":"profile"}`)}/>{area==="parts"?<Button variant="ghost" label={d.t("Delivery settings","إعدادات التوصيل")} onPress={()=>go("/provider/parts/delivery")}/>:isDriver.data?<Button variant="ghost" label={d.t("My driver profile and jobs","ملفي ومهامي كسائق")} onPress={()=>go("/driver")}/>:null}</Panel></ProviderLayout>;}
