import {api} from "../../core/config/api";
import type {CarModel} from "../car3d/models";
export type Brand={id:string;name:string;nameAr:string;aliases:string[];isActive:boolean};
export type Generation={id:string;code:string;nameEn:string;nameAr:string;yearFrom:number;yearTo:number;isActive:boolean;isPublished:boolean;effectiveAvailable:boolean;model3dKey:string|null};
export type Model={id:string;brandId:string|null;make:string;displayMake:string;makeAr:string;model:string;modelAr:string;yearFrom:number;yearTo:number;isActive:boolean;generations:Generation[]};
export type Taxonomy={brands:Brand[];vehicles:Model[]};
export type SketchfabInspection={uid:string;title:string;author:string;authorUrl:string|null;url:string;thumbnail:string|null;license:string;licenseUrl:string|null;licenseClass:string|null;downloadable:boolean;allowed:boolean;refusalCode:string|null;inspectedAt:string;duplicate:{importId:string|null;name:string;model3dKey:string|null;status:string}|null};
export type Provenance=Pick<SketchfabInspection,"uid"|"title"|"authorUrl"|"licenseUrl"|"licenseClass"|"downloadable"|"inspectedAt"|"thumbnail">&{downloadedAt:string|null;downloadSource:string|null;sourceSha256:string|null;originalDownloadedBytes:number|null;preparedSha256:string|null;optimization:{warnings:string[];bytesBefore:number;bytesAfter:number;removed:number}|null};
export type ModelImport={id:string;generationId:string;status:string;progress:number|null;errorCode:string|null;failureReason:string|null;make:string;model:string;code:string;yearFrom:number;yearTo:number;source:string;author:string;license:string;sourceUrl:string|null;provenance:Provenance|null;hasModel:boolean;hasRawModel:boolean;viewerConfig:CarModel|null;validation:Record<string,unknown>|null;existingModel3dKey:string|null;publishedModel3dKey:string|null;partMapStatus?:string|null};
export const taxonomyPath="/admin/parts/vehicles";
export const importPath="/admin/parts/vehicle-3d-imports";
export const vehicleCatalog={
 list:()=>api<Taxonomy>("GET",taxonomyPath),
 save:async(kind:string,id:string|null,body:unknown)=>(await api<{record:{id:string}}>(id?"PATCH":"POST",`${taxonomyPath}/${kind}${id?`/${id}`:""}`,body)).record,
 remove:(kind:string,id:string)=>api("DELETE",`${taxonomyPath}/${kind}/${id}`),
 suggestions:(make:string,model:string,year:number)=>api<{generations:(Generation&{make:string;model:string})[];brands:Brand[];models:Model[]}>("GET",`${taxonomyPath}/suggestions?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`),
 imports:async()=>(await api<{imports:ModelImport[]}>("GET",importPath)).imports,
 getImport:async(id:string)=>(await api<{import:ModelImport}>("GET",`${importPath}/${id}`)).import,
 inspect:async(url:string)=>(await api<{inspection:SketchfabInspection}>("POST",`${importPath}/sketchfab/inspect`,{url})).inspection,
 importSketchfab:async(body:{url:string;generationId:string;yearFrom:number;yearTo:number})=>(await api<{import:ModelImport}>("POST",`${importPath}/sketchfab`,body)).import,
 retry:(id:string)=>api("POST",`${importPath}/${id}/retry`,{}),
 discard:(id:string)=>api("POST",`${importPath}/${id}/discard`,{}),
 upload:async(body:unknown)=>(await api<{import:ModelImport}>("POST",importPath,body)).import,
 validate:(id:string,config:unknown)=>api("POST",`${importPath}/${id}/validate`,{config}),
 publish:(id:string,body:unknown)=>api("POST",`${importPath}/${id}/publish`,body),
};
