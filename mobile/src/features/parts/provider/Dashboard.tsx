import { useSessionUser } from "../../../core/session/session";
import { useLoad } from "../../../core/hooks/useLoad";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { portalApi } from "../../provider/portal/api";
import { Async,Button,Panel,Pill,MetricGrid,RecentActivity,SectionLinks,useDT,go } from "../../provider/portal/ui";
export default function PartsDashboard(){const d=useDT(),u=useSessionUser(),state=useLoad(()=>portalApi.summary("parts"),[u.id]);return <ProviderLayout area="parts" title={d.t("Shop dashboard","لوحة المتجر")} subtitle={state.data?.identity.name} onRefresh={state.reload} refreshing={state.loading&&!!state.data}>
  <Async state={state}>{data=><>
    <Panel title={data.identity.name}><Pill tone="ok" label={d.t("Approved shop","متجر معتمد")}/><Button label={d.t("Preview as customer","معاينة كعميل")} variant="ghost" onPress={()=>go("/provider/parts/preview")}/></Panel>
    <MetricGrid items={[["Customer-visible products","منتجات ظاهرة للعملاء","visibleProducts","products"],["Pending orders","طلبات قيد التنفيذ","pendingOrders","orders"],["Products with published 3D","منتجات بنماذج منشورة","products3d","3d"],["Out of stock","نفد المخزون","outOfStock","inventory"]].map(([en,ar,key,path])=>({label:d.t(en,ar),value:data.metrics[key]??0,path:`/provider/parts/${path}`}))}/>
    <Panel title={d.t("Quick actions","إجراءات سريعة")}><Button label={d.t("Add product","إضافة منتج")} onPress={()=>go("/provider/parts/new")}/><Button variant="ghost" label={d.t("Manage 3D Parts","إدارة القطع ثلاثية الأبعاد")} onPress={()=>go("/provider/parts/3d")}/></Panel>
    <Panel title={d.t("Pending actions","إجراءات مطلوبة")}><Button variant="ghost" label={d.t(`${data.metrics.missingPhotos} products need real photos`,`${data.metrics.missingPhotos} منتجات بحاجة إلى صور حقيقية`)} onPress={()=>go("/provider/parts/products")}/><Button variant="ghost" label={d.t(`${data.metrics.pending3d} 3D parts in review or generation`,`${data.metrics.pending3d} قطع ثلاثية الأبعاد قيد المراجعة أو الإنشاء`)} onPress={()=>go("/provider/parts/3d/submissions")}/></Panel>
    <RecentActivity data={data}/><MetricGrid items={[["Low stock","مخزون منخفض","lowStock"],["Customer questions","استفسارات العملاء","openInquiries"],["Completed orders","طلبات مكتملة","completedOrders"],["Fitment covered","منتجات ذات توافق محدد","fitmentCovered"]].map(([en,ar,key])=>({label:d.t(en,ar),value:data.metrics[key]??0}))}/><SectionLinks area="parts"/>
  </>}</Async>
 </ProviderLayout>;}
