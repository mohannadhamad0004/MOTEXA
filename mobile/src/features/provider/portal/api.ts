import { api } from "../../../core/config/api";
import type { ProviderArea, PortalSummary, ProviderMedia, ShopProfile, Provider3dProduct } from "./types";
export const portalBase=(area:ProviderArea)=>`/${area}/me/portal`;
export const portalApi={
  summary:(area:ProviderArea)=>api<PortalSummary>("GET",portalBase(area)+"/summary"),
  identity:(area:ProviderArea)=>api<{id:string;name:string}>("GET",portalBase(area)+"/identity"),
  media:async(area:ProviderArea)=>(await api<{media:ProviderMedia[]}>("GET",portalBase(area)+"/media")).media,
  upload:(area:ProviderArea,body:{slot:string;dataBase64:string;truckId?:string;replaceId?:string})=>api("POST",portalBase(area)+"/media",body),
  remove:(area:ProviderArea,id:string)=>api("DELETE",`${portalBase(area)}/media/${id}`),
  profile:async()=>(await api<{shop:ShopProfile}>("GET","/parts/me/portal/profile")).shop,
  updateProfile:(body:Record<string,unknown>)=>api("PATCH","/parts/me/portal/profile",body),
  products3d:(page=1,q="",submissions=false)=>api<{products:Provider3dProduct[];page:number;hasMore:boolean;total:number}>("GET",`/parts/me/portal/3d?page=${page}&q=${encodeURIComponent(q)}${submissions?"&submissions=1":""}`),
  product3d:(id:string)=>api<Provider3dProduct>("GET",`/parts/me/portal/3d/${id}`),
};
