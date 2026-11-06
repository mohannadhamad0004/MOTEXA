import type { CatalogShop } from "./catalogService";
import { PrivatePhoto } from "../../components/garage";
import { PublicMedia } from "../provider/portal/MediaPage";
import { Panel,Text,Pill,useDT } from "../provider/portal/ui";
import { cityLabel } from "../../core/constants/cities";
export function ShopPublicProfile({shop}:{shop:CatalogShop}){const d=useDT();return <>
 <Panel title={d.ar?shop.nameAr??shop.name:shop.name}>{shop.storefrontUri?<PrivatePhoto uri={shop.storefrontUri} fallback="service.parts" style={{width:"100%",height:180,borderRadius:16}}/>:null}<Text style={{color:d.muted,textAlign:d.align}}>{[shop.brandName,shop.branchName,cityLabel(shop.city,d.ar),shop.address].filter(Boolean).join(" · ")}</Text>{shop.workingHours?<Text style={{color:d.ink,textAlign:d.align}}>{shop.workingHours}</Text>:null}<Pill tone="ok" label={d.t("Verified by MOTEXA","موثّق من موتكسا")}/></Panel><PublicMedia media={shop.media??[]}/>
 </>;}
