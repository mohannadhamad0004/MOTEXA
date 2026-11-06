import { useLocalSearchParams } from "expo-router";
import { Image } from "react-native";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSessionUser,asActor } from "../../../core/session/session";
import { partsShopService } from "../partsService";
import { formatPrice } from "../../../core/constants/money";
import { Async,Panel,Text,Button,Pill,useDT,go } from "../../provider/portal/ui";
import { typesForCategory } from "../../accessory3d/api";
export default function ProductDetailPage(){const {id}=useLocalSearchParams<{id:string}>(),user=useSessionUser(),d=useDT(),state=useLoad(()=>partsShopService.getMyProduct(asActor(user),id),[id,user.id]);return <ProviderLayout area="parts" title={state.data?.name??d.t("Product","المنتج")} onRefresh={state.reload}>
 <Async state={state}>{p=><>
  <Panel title={d.t("Product overview","نظرة على المنتج")}>{p.imageUri?<Image source={{uri:p.imageUri}} style={{width:"100%",height:210,borderRadius:16}}/>:null}<Text style={{color:d.ink,textAlign:d.align,fontSize:23,fontWeight:"800"}}>{formatPrice(p.price)}</Text><Text style={{color:d.muted,textAlign:d.align}}>{p.description}</Text><Text style={{color:d.muted,textAlign:d.align}}>{p.brand} · {p.partNumber}</Text><Pill label={p.customerVisible?d.t("Visible to customers","ظاهر للعملاء"):p.hidden?d.t("Hidden by MOTEXA","مخفي بواسطة موتكسا"):d.t("Not publicly visible","غير ظاهر للعملاء")} tone={p.customerVisible?"ok":"amber"}/>{p.hiddenReason?<Text style={{color:d.bad,textAlign:d.align}}>{p.hiddenReason}</Text>:null}</Panel>
  <Panel title={d.t("Inventory and fitment","المخزون والتوافق")}><Text style={{color:d.ink,textAlign:d.align}}>{d.t(`Stock: ${p.stock} · Reserved: ${p.reservedStock??0}`,`المخزون: ${p.stock} · المحجوز: ${p.reservedStock??0}`)}</Text>{p.isUniversal?<Text style={{color:d.muted,textAlign:d.align}}>{d.t("Universal","عام لجميع المركبات")}</Text>:p.fitments.map((f,i)=><Text key={i} style={{color:d.muted,textAlign:d.align}}>{f.make} {f.model} · {f.yearFrom}–{f.yearTo}</Text>)}</Panel>
  <Button label={d.t("Edit product","تعديل المنتج")} onPress={()=>go(`/provider/parts/products/edit/${id}`)}/>
  {typesForCategory(p.category).length?<><Button variant="ghost" label={d.t("Manage 3D submission","إدارة الطلب ثلاثي الأبعاد")} onPress={()=>go(`/provider/parts/accessory-3d/${id}`)}/><Button variant="ghost" label={d.t("Preview 3D / View on car","معاينة ثلاثية الأبعاد / عرض على سيارة")} onPress={()=>go(`/provider/parts/3d/preview/${id}`)}/></>:null}
  <Button variant="ghost" label={d.t("Customer preview","معاينة العميل")} onPress={()=>go(`/provider/parts/preview?productId=${id}`)}/>
 </>}</Async></ProviderLayout>;}
