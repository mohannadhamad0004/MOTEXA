import { useState } from "react";
import { Image,View } from "react-native";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { SearchBar } from "../../../components/ui/Input";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSessionUser,asActor } from "../../../core/session/session";
import { formatPrice } from "../../../core/constants/money";
import { partsShopService } from "../partsService";
import { fitmentSummary } from "../partsBits";
import { Async,Button,EmptyState,ItemCard,Pill,Text,useDT,go } from "../../provider/portal/ui";
export default function ProductsPage({mode="products"}:{mode?:"products"|"inventory"|"fitment"}){
 const d=useDT(),user=useSessionUser();const [q,setQ]=useState(""),[page,setPage]=useState(1),[stock,setStock]=useState("");
 const state=useLoad(()=>partsShopService.getMyInventory(asActor(user),{page,q,stock}),[user.id,page,q,stock]);
 return <ProviderLayout area="parts" title={mode==="inventory"?d.t("Inventory","المخزون"):mode==="fitment"?d.t("Vehicle fitment","توافق المركبات"):d.t("Products","المنتجات")} onRefresh={state.reload} refreshing={state.loading&&!!state.data}>
  <Button label={d.t("Add product","إضافة منتج")} onPress={()=>go("/provider/parts/new")}/>
  <SearchBar value={q} onChange={v=>{setQ(v);setPage(1);}} placeholder={d.t("Name, brand or part number","الاسم أو العلامة أو رقم القطعة")}/>
  <View style={{flexDirection:d.row,flexWrap:"wrap",gap:6,marginBottom:16}}>{[["","All","الكل"],["in","In stock","متوفر"],["low","Low stock","منخفض"],["out","Out of stock","نفد"]].map(([key,en,ar])=><Button key={key} size="sm" variant={stock===key?"primary":"ghost"} label={d.t(en,ar)} onPress={()=>{setStock(key);setPage(1);}}/>)}</View>
  <Async state={state}>{({products,hasMore})=><>
   {!products.length?<EmptyState icon="images-outline" text={d.t("No matching products. Add a product or change the filters.","لا توجد منتجات مطابقة. أضف منتجًا أو غيّر الفلاتر.")}/>:products.map(p=><ItemCard key={p.id} label={p.name} onPress={()=>go(`/provider/parts/products/${p.id}`)}>
    <View style={{flexDirection:d.row,gap:12,alignItems:"center"}}>{p.imageUri?<Image source={{uri:p.imageUri}} style={{width:60,height:60,borderRadius:12}}/>:null}<View style={{flex:1,minWidth:0}}><Text style={{color:d.ink,fontSize:16,lineHeight:24,fontWeight:"700",textAlign:d.align}}>{p.name}</Text><Text style={{color:d.muted,textAlign:d.align,fontSize:12}}>{p.brand} · {p.partNumber}</Text><Text style={{color:d.accent,textAlign:d.align,fontWeight:"700"}}>{formatPrice(p.price)}</Text></View></View>
    <View style={{flexDirection:d.row,flexWrap:"wrap",gap:6,marginTop:10}}><Pill tone={p.customerVisible?"ok":"amber"} label={p.customerVisible?d.t("Visible to customers","ظاهر للعملاء"):p.hidden?d.t("Hidden by MOTEXA","مخفي بواسطة موتكسا"):d.t("Not publicly visible","غير ظاهر للعملاء")}/><Pill label={`${d.t("Available","متاح")}: ${Math.max(0,p.stock-(p.reservedStock??0))}`}/></View>
    {mode==="inventory"?<Text style={{color:d.muted,textAlign:d.align,marginTop:8}}>{d.t(`Stock ${p.stock} · Reserved ${p.reservedStock??0}`,`المخزون ${p.stock} · المحجوز ${p.reservedStock??0}`)}</Text>:null}
    <Text style={{color:d.muted,textAlign:d.align,marginTop:8}}>{p.isUniversal?d.t("Universal","عام لجميع المركبات"):fitmentSummary(p,d.t)}</Text>
   </ItemCard>)}
   <View style={{flexDirection:d.row,gap:10,marginTop:12}}><Button variant="ghost" disabled={page===1} label={d.t("Previous","السابق")} onPress={()=>setPage(v=>v-1)}/><Button variant="ghost" disabled={!hasMore} label={d.t("Next","التالي")} onPress={()=>setPage(v=>v+1)}/></View>
  </>}</Async>
 </ProviderLayout>;
}
