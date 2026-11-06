import type { ProviderArea } from "./types";
export type PortalLink={path:string;en:string;ar:string};
export const providerLinks:Record<ProviderArea,PortalLink[]>={
  tow:[
    {path:"",en:"Dashboard",ar:"لوحة التحكم"},{path:"dispatch",en:"Jobs",ar:"المهام"},{path:"active",en:"Active jobs",ar:"المهام الجارية"},{path:"history",en:"History",ar:"السجل"},{path:"trucks",en:"Trucks",ar:"الشاحنات"},{path:"drivers",en:"Drivers",ar:"السائقون"},{path:"company",en:"Profile",ar:"الملف"},{path:"media",en:"Media",ar:"الوسائط"},{path:"preview",en:"Customer preview",ar:"معاينة العميل"},{path:"availability",en:"Availability",ar:"التوفر"},{path:"service-area",en:"Service area",ar:"منطقة الخدمة"},{path:"live",en:"Live map",ar:"الخريطة"},{path:"settings",en:"Settings",ar:"الإعدادات"},
  ],
  parts:[
    {path:"",en:"Dashboard",ar:"لوحة التحكم"},{path:"products",en:"Products",ar:"المنتجات"},{path:"orders",en:"Orders",ar:"الطلبات"},{path:"3d",en:"3D Parts",ar:"قطع ثلاثية الأبعاد"},{path:"3d/submissions",en:"3D submissions",ar:"طلبات ثلاثية الأبعاد"},{path:"inventory",en:"Inventory",ar:"المخزون"},{path:"fitment",en:"Fitment",ar:"التوافق"},{path:"categories",en:"Categories",ar:"الفئات"},{path:"inquiries",en:"Questions",ar:"الاستفسارات"},{path:"profile",en:"Shop profile",ar:"ملف المتجر"},{path:"media",en:"Media",ar:"الوسائط"},{path:"preview",en:"Customer preview",ar:"معاينة العميل"},{path:"analytics",en:"Performance",ar:"الأداء"},{path:"delivery",en:"Delivery",ar:"التوصيل"},{path:"settings",en:"Settings",ar:"الإعدادات"},
  ],
};
export const providerPath=(area:ProviderArea,path="")=>`/provider/${area}${path?"/"+path:""}`;
