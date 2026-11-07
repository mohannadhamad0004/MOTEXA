import { useState } from "react";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { SettingsSheet } from "../../../components/blueprint";
import type { ProviderArea } from "./types";
import { useLoad } from "../../../core/hooks/useLoad";
import { api } from "../../shared/api";
import { Panel,Button,useDT,go } from "./ui";
// the owner only sees the driver link when he is also a driver (a company driver row with isOwner)
export default function SettingsPage({area}:{area:ProviderArea}){const d=useDT(),[open,setOpen]=useState(false),isDriver=useLoad(()=>area==="tow"?api<{drivers:{isOwner:boolean}[]}>("GET","/tow/me/drivers").then(r=>r.drivers.some(x=>x.isOwner),()=>false):Promise.resolve(false),[area]);; return <ProviderLayout area={area} title={d.t("Settings","الإعدادات")}><Panel><Button label={d.t("Language, appearance and account","اللغة والمظهر والحساب")} onPress={()=>setOpen(true)}/><Button variant="ghost" label={d.t("Business profile","ملف النشاط")} onPress={()=>go(`/provider/${area}/${area==="tow"?"company":"profile"}`)}/>{area==="parts"?<Button variant="ghost" label={d.t("Delivery settings","إعدادات التوصيل")} onPress={()=>go("/provider/parts/delivery")}/>:isDriver.data?<Button variant="ghost" label={d.t("My driver profile and jobs","ملفي ومهامي كسائق")} onPress={()=>go("/driver")}/>:null}</Panel><SettingsSheet visible={open} onClose={()=>setOpen(false)} signOutButton/></ProviderLayout>;}
