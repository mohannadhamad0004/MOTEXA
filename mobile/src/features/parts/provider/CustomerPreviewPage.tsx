import { ProductAccessory3D } from "../../accessory3d/customer";
import { useLocalSearchParams } from "expo-router";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { useLoad } from "../../../core/hooks/useLoad";
import { portalApi } from "../../provider/portal/api";
import { catalogService } from "../../catalog/catalogService";
import { ShopPublicProfile } from "../../catalog/ShopPublicProfile";
import { ProductCard } from "../../../components/garage";
import { Async,Panel,Text,Button,useDT,go } from "../../provider/portal/ui";
export default function CustomerPreviewPage(){const d=useDT(),{productId}=useLocalSearchParams<{productId?:string}>(),state=useLoad(async()=>{const {id}=await portalApi.identity("parts");const data=await catalogService.getShop(id);return {...data,products:productId?data.products.filter(p=>p.id===productId):data.products};},[productId]);return <ProviderLayout area="parts" title={d.t("Customer shop preview","معاينة المتجر للعميل")} onRefresh={state.reload}><Async state={state}>{data=><><ShopPublicProfile shop={data.shop}/><Panel title={d.t("Customer-visible products","المنتجات الظاهرة للعملاء")}>
 {!data.products.length?<Text style={{color:d.muted,textAlign:d.align}}>{d.t("No publicly visible matching products. Visibility requires shop approval, a real photo and no moderation restriction.","لا توجد منتجات مطابقة ظاهرة للعملاء. يتطلب الظهور اعتماد المتجر وصورة حقيقية وعدم وجود منع إداري.")}</Text>:data.products.slice(0,20).map(p=><Panel key={p.id}><ProductCard p={p} onPress={()=>go(`/provider/parts/products/${p.id}`)}/><ProductAccessory3D productId={p.id} car={null} onPreview={()=>go(`/provider/parts/3d/preview/${p.id}`)}/><Button variant="ghost" label={d.t("Preview 3D / View on car","معاينة ثلاثية الأبعاد / عرض على سيارة")} onPress={()=>go(`/provider/parts/3d/preview/${p.id}`)}/></Panel>)}
 </Panel></>}</Async></ProviderLayout>;}
