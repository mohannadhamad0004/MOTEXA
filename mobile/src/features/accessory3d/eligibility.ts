import type {CustomerPart} from "./api";
export type PreviewChoice={carId:string;isActive:boolean;allowed:boolean};
/** 3D previews follow the ACTIVE car only: never another saved car, never a fallback when the active car has no fit. */
export function selectPreviewCar<T extends PreviewChoice>(cars:readonly T[]){
 return cars.find(c=>c.isActive);
}
/** Older, incomplete and failed API contracts fail closed. The viewer never substitutes a live fit for a rejected result. */
export function canPreviewPart(part:CustomerPart){return part.allowed===true&&!!part.model&&!!part.autoFit;}
