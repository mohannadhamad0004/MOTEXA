import { useState } from "react";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { SettingsSheet } from "../../../components/blueprint";
import type { ProviderArea } from "./types";
import { Panel,Button,useDT,go } from "./ui";
export default function SettingsPage({area}:{area:ProviderArea}){const d=useDT(),[open,setOpen]=useState(false);return <ProviderLayout area={area} title={d.t("Settings","الإعدادات")}><Panel><Button label={d.t("Language, appearance and account","اللغة والمظهر والحساب")} onPress={()=>setOpen(true)}/><Button variant="ghost" label={d.t("Business profile","ملف النشاط")} onPress={()=>go(`/provider/${area}/${area==="tow"?"company":"profile"}`)}/>{area==="parts"?<Button variant="ghost" label={d.t("Delivery settings","إعدادات التوصيل")} onPress={()=>go("/provider/parts/delivery")}/>:<Button variant="ghost" label={d.t("My driver profile and jobs","ملفي ومهامي كسائق")} onPress={()=>go("/driver")}/>}</Panel><SettingsSheet visible={open} onClose={()=>setOpen(false)} signOutButton/></ProviderLayout>;}
