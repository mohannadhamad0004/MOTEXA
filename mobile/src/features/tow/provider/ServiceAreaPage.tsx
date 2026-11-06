import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { useLoad } from "../../../core/hooks/useLoad";
import { asActor,useSessionUser } from "../../../core/session/session";
import { cityLabel } from "../../../core/constants/cities";
import { towFleetService } from "../towService";
import { MAPS_AVAILABLE,PinMap } from "../../shared/maps";
import { Async,Panel,Text,Button,useDT,go } from "../../provider/portal/ui";
export default function ServiceAreaPage(){const d=useDT(),u=useSessionUser(),state=useLoad(()=>towFleetService.getMyFleet(asActor(u)),[u.id]);return <ProviderLayout area="tow" title={d.t("Service area","منطقة الخدمة")} onRefresh={state.reload}><Async state={state}>{({company:c})=><Panel title={cityLabel(c.city,d.ar)}><Text style={{color:d.muted,textAlign:d.align}}>{c.serviceCities.length?c.serviceCities.map(x=>cityLabel(x,d.ar)).join(" · "):d.t("No additional service cities selected.","لم تُحدّد مدن خدمة إضافية.")}</Text>{MAPS_AVAILABLE&&c.baseLat!==null&&c.baseLng!==null?<PinMap point={{lat:c.baseLat,lng:c.baseLng}} height={200}/>:null}<Button label={d.t("Edit service area and base location","تعديل منطقة الخدمة والموقع")} onPress={()=>go("/provider/tow/company")}/></Panel>}</Async></ProviderLayout>;}
