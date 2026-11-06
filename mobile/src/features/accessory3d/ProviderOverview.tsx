import { useState } from "react";
import { ProviderLayout } from "../../components/layout/ProviderLayout";
import { SearchBar } from "../../components/ui/Input";
import { useLoad } from "../../core/hooks/useLoad";
import { portalApi } from "../provider/portal/api";
import { STATUS_LABELS,ACCESSORY_TYPE_LABELS } from "./api";
import { fitLabel,replacementLabel } from "./fitPresentation";
import { Async,Panel,Text,Button,EmptyState,useDT,go } from "../provider/portal/ui";
export default function ProviderOverview({submissions=false}:{submissions?:boolean}){const d=useDT(),[page,setPage]=useState(1),[q,setQ]=useState(""),state=useLoad(()=>portalApi.products3d(page,q,submissions),[page,q,submissions]);return <ProviderLayout area="parts" title={submissions?d.t("3D submissions","طلبات ثلاثية الأبعاد"):d.t("3D Parts","قطع ثلاثية الأبعاد")} subtitle={d.t("Product → accessory → model → validation → fitment → View on car","المنتج ← الإكسسوار ← النموذج ← التحقق ← التوافق ← العرض على السيارة")} onRefresh={state.reload}>
 <SearchBar value={q} onChange={v=>{setQ(v);setPage(1);}} placeholder={d.t("Search products","ابحث عن منتج")}/><Async state={state}>{data=><>
 {!data.products.length?<EmptyState icon="cube-outline" text={d.t("No 3D products yet. Add a Body, Exterior Accessories or Wheels product to begin.","لا توجد منتجات ثلاثية الأبعاد بعد. أضف منتج هيكل أو إكسسوار خارجي أو جنوط للبدء.")}/>:data.products.map(p=><Panel key={p.id} title={p.name}>
  {!p.parts.length?<Text style={{color:d.muted,textAlign:d.align}}>{d.t("No 3D model","لا يوجد نموذج ثلاثي الأبعاد")}</Text>:p.parts.map(part=><Panel key={part.id} title={d.t(...ACCESSORY_TYPE_LABELS[part.type])}>
   <Text style={{color:d.ink,textAlign:d.align,lineHeight:22}}>{d.t(...STATUS_LABELS[part.status])}</Text><Text style={{color:d.muted,textAlign:d.align}}>{part.validated?d.t("Technical validation recorded","تم تسجيل التحقق التقني"):d.t("Not technically validated yet","لم يُتحقق تقنيًا بعد")}</Text>
   {part.generations.length?part.generations.map(g=><Panel key={g.id} title={d.ar?g.nameAr:g.name}><Text style={{color:d.muted,textAlign:d.align}}>{fitLabel(g.fitState,d.t)}</Text><Text style={{color:d.muted,textAlign:d.align}}>{d.t("Replaces: ","يستبدل: ")}{replacementLabel(g.replacement,d.t)}</Text><Text style={{color:d.muted,textAlign:d.align}}>{g.has3d?d.t("Vehicle 3D available","نموذج السيارة متاح"):d.t("Vehicle 3D unavailable","نموذج السيارة غير متاح")}</Text></Panel>):<Text style={{color:d.muted,textAlign:d.align}}>{d.t("No compatible generation selected.","لم يُحدد جيل متوافق.")}</Text>}
   <Text style={{color:d.muted,fontSize:11,textAlign:d.align}}>{new Date(part.updatedAt).toLocaleString(d.ar?"ar":"en")}</Text>{part.reviewNotes?<Text style={{color:d.warn,textAlign:d.align}}>{part.reviewNotes}</Text>:null}
  </Panel>)}
  <Button variant="ghost" label={d.t("Manage submission","إدارة الطلب")} onPress={()=>go(`/provider/parts/accessory-3d/${p.id}`)}/><Button variant="ghost" label={d.t("Preview 3D / View on car","معاينة ثلاثية الأبعاد / عرض على سيارة")} onPress={()=>go(`/provider/parts/3d/preview/${p.id}`)}/><Button variant="ghost" label={d.t("Product details","تفاصيل المنتج")} onPress={()=>go(`/provider/parts/products/${p.id}`)}/>
 </Panel>)}
 <Button disabled={page===1} variant="ghost" label={d.t("Previous","السابق")} onPress={()=>setPage(v=>v-1)}/><Button disabled={!data.hasMore} variant="ghost" label={d.t("Next","التالي")} onPress={()=>setPage(v=>v+1)}/>
 </>}</Async></ProviderLayout>;}
