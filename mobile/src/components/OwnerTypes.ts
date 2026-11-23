export type OwnerVehicle={photoUpdatedAt?:string|null;photoDataUri?:string;id:string;make:string;model:string;year:number;fuel:string;isActive:boolean;version:number;createdAt?:string;updatedAt?:string};
export type OwnerVehicleInput={photoBase64?:string;photoRemove?:boolean;make:string;model:string;year:number;fuel:string};
export type OwnerMechanic={userId:string;city:string|null;workshopName:string|null;workshopAddress:string|null;workshopLatitude?:number|null;workshopLongitude?:number|null;coverageAreas?:string[];yearsOfExperience:number|null;specializations:string[];experienceSummary?:string|null;offersWorkshop?:boolean;offersOnSite?:boolean;offersOnline?:boolean;user:{fullName:string}};
export type OwnerRequest={id:string;title:string;vehicle:string;vehicleId?:string|null;status:string;mode:string;version:number;decisionNote:string|null;createdAt:string;updatedAt?:string;mechanic:{fullName:string};description?:string;address?:string;contactNumber?:string};
export type OwnerAccount={fullName:string;email:string;phoneNumber:string|null};
export type OwnerTransport=<T=any>(route:string,method?:string,body?:unknown)=>Promise<T>;
export const vehicleName=(vehicle:OwnerVehicle)=>`${vehicle.make} ${vehicle.model} · ${vehicle.year}`;
