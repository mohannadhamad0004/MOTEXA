import {api} from "../../core/config/api";
import type {CarModel} from "../car3d/models";
import type {ModelGate} from "../accessory3d/api";
import {authenticatedBase64} from "../vehicle3d/api";
export type ModelStatus="PUBLISHED"|"HIDDEN"|"IN_REVIEW"|"FAILED";
export type DeleteImpact={current:boolean;published:boolean;garageCars:number;accessoryFits:number;shopAccessories:number;partMaps:number;zones:number;imports:number};
export type Managed3DModel={limits:Partial<Record<string,string>>;key:string;status:ModelStatus;bodyType:string|null;nameEn:string;nameAr:string;brandId:string|null;aliases:string[];generationId:string;make:string;model:string;code:string;yearFrom:number;yearTo:number;published:boolean;reviewRequired?:boolean;current:boolean;revision:number;sha256:string;bytes:number|null;viewerConfig:CarModel;source:string;provenance:{title:string;author:string;license:string;url:string;authorUrl:string|null;licenseUrl:string|null};validation:unknown;qualityGate:ModelGate|null;partMapStatus:string;paintSupport:boolean;createdAt:string;updatedAt:string;references:Record<string,number>;canDelete:boolean;importId:string|null;submissionId:string|null};
const base="/admin/parts/vehicle-3d-models";
export const modelApi={
 asset:(key:string)=>authenticatedBase64(`${base}/${key}/model`),
 list:async()=>(await api<{models:Managed3DModel[]}>("GET",base)).models,
 get:async(key:string)=>(await api<{model:Managed3DModel}>("GET",`${base}/${key}`)).model,
 configure:(key:string,revision:number,config:unknown)=>api("PATCH",`${base}/${key}/config`,{revision,config}),
 publication:(key:string,revision:number,published:boolean,visuallyVerified=false)=>api("POST",`${base}/${key}/publication`,{revision,published,visuallyVerified}),
 deleteImpact:async(key:string)=>(await api<{impact:DeleteImpact}>("GET",`${base}/${key}/delete-impact`)).impact,
 deleteModel:(key:string)=>api("DELETE",`${base}/${key}`,{confirm:true}),
};
