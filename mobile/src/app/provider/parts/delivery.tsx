import { useState } from "react";
import { View } from "react-native";
import { Card,Field,GButton,Note,Toggle } from "../../../components/garage";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { Async } from "../../../components/ui/Feedback";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { shopOrders } from "../../../features/orders/ordersService";

function DeliveryForm({initial}:{initial:Awaited<ReturnType<typeof shopOrders.delivery>>}){
 const {t}=useL(),[enabled,setEnabled]=useState(initial.enabled),[fee,setFee]=useState(initial.fee===null?"":String(initial.fee)),[area,setArea]=useState(initial.areaNote??""),[busy,setBusy]=useState(false),[msg,setMsg]=useState<{ok:boolean;text:string}|null>(null);
 const feeOk=fee.trim()===""||/^\d+(\.\d{1,2})?$/.test(fee.trim());
 const save=async()=>{setBusy(true);setMsg(null);try{await shopOrders.saveDelivery({enabled,fee:fee.trim()===""?null:Number(fee.trim()),areaNote:area.trim()||null});setMsg({ok:true,text:t("Saved.","تم الحفظ.")});}catch(e){setMsg({ok:false,text:(e as Error).message});}finally{setBusy(false);}};
 return <View style={{gap:12}}><Card><Toggle label={t("I deliver orders","أوصل الطلبات")} sub={enabled?t("Customers can choose delivery","يمكن للزبائن اختيار التوصيل"):t("Pickup only","الاستلام فقط")} value={enabled} onChange={setEnabled}/></Card>
 {enabled?<Card><Field label={t("Delivery fee (₪), empty = agreed with the customer","رسوم التوصيل (₪)، فارغ = بالاتفاق مع الزبون")} value={fee} onChangeText={setFee} keyboardType="decimal-pad" error={feeOk?undefined:t("A number, e.g. 10 or 7.5","رقم، مثل 10 أو 7.5")}/><Field label={t("Where you deliver","أين توصل")} value={area} onChangeText={setArea} maxLength={300} multiline/></Card>:null}
 <Note>{t("Payment is cash only: on delivery, or at the shop for pickup.","الدفع نقدًا فقط: عند التوصيل، أو في المتجر عند الاستلام.")}</Note>{msg?<Note tone={msg.ok?"success":"danger"}>{msg.text}</Note>:null}<GButton label={t("Save","حفظ")} busy={busy} disabled={!feeOk} onPress={()=>void save()}/></View>;
}
export default function ShopDeliverySettings(){const {t}=useL(),state=useLoad(()=>shopOrders.delivery(),[]);return <ProviderLayout area="parts" title={t("Delivery","التوصيل")} subtitle={t("You deliver the orders yourself","توصل الطلبات بنفسك")}><Async state={state}>{data=><DeliveryForm initial={data}/>}</Async></ProviderLayout>;}
