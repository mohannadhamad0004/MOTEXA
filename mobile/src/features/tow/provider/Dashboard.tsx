import { useSessionUser } from "../../../core/session/session";
import { useLoad } from "../../../core/hooks/useLoad";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { MoClip } from "../../../components/garage/MoClip";
import { portalApi } from "../../provider/portal/api";
import { Async,Button,Panel,MetricGrid,RecentActivity,SectionLinks,useDT,go } from "../../provider/portal/ui";
export default function TowDashboard(){const d=useDT(),u=useSessionUser(),state=useLoad(()=>portalApi.summary("tow"),[u.id]);return <ProviderLayout area="tow" title={d.t("Towing dashboard","لوحة السحب")} subtitle={state.data?.identity.name} onRefresh={state.reload} refreshing={state.loading&&!!state.data}>
  <Async state={state}>{data=><>
    <Panel title={data.identity.name}><MoClip clip="tow" width={260} label={d.t("MOTEXA towing video","فيديو سحب موتيكسا")}/><Button label={d.t("Preview as customer","معاينة كعميل")} variant="ghost" onPress={()=>go("/provider/tow/preview")}/></Panel>
    <MetricGrid items={[["New requests","طلبات جديدة","newRequests","dispatch"],["Active jobs","مهام جارية","activeJobs","active"],["Available trucks","شاحنات متاحة","availableTrucks","availability"],["Completed jobs","مهام مكتملة","completedJobs","history"]].map(([en,ar,key,path])=>({label:d.t(en,ar),value:data.metrics[key]??0,path:`/provider/tow/${path}`}))}/>
    <Panel title={d.t("Quick actions","إجراءات سريعة")}><Button label={d.t("Manage jobs","إدارة المهام")} onPress={()=>go("/provider/tow/dispatch")}/><Button variant="ghost" label={d.t("Add truck","إضافة شاحنة")} onPress={()=>go("/provider/tow/new")}/></Panel>
    <Panel title={d.t("Pending actions","إجراءات مطلوبة")}><Button variant="ghost" label={d.t(`${data.metrics.newRequests} requests need an answer`,`${data.metrics.newRequests} طلبات بحاجة إلى رد`)} onPress={()=>go("/provider/tow/dispatch")}/><Button variant="ghost" label={d.t(`${data.metrics.trucks-data.metrics.approvedTrucks} trucks awaiting approval`,`${data.metrics.trucks-data.metrics.approvedTrucks} شاحنات غير معتمدة`)} onPress={()=>go("/provider/tow/trucks")}/></Panel>
    <RecentActivity data={data}/><MetricGrid items={[["Drivers","السائقون","drivers"],["Cancelled jobs","المهام الملغاة","cancelledJobs"],["Declined jobs","المهام المرفوضة","declinedJobs"],["All requests","كل الطلبات","requests"]].map(([en,ar,key])=>({label:d.t(en,ar),value:data.metrics[key]??0}))}/><SectionLinks area="tow"/>
  </>}</Async>
 </ProviderLayout>;}
