import type {CustomerPart} from "./api";
export type PreviewChoice={carId:string;isActive:boolean;allowed:boolean};
/** Local preview selection never activates or edits a Garage car. The server decides eligibility. */
export function selectPreviewCar<T extends PreviewChoice>(cars:readonly T[],selected:string|null){
 return cars.find(c=>c.carId===selected)??cars.find(c=>c.isActive&&c.allowed)??cars.find(c=>c.allowed)??cars.find(c=>c.isActive)??cars[0];
}
/** Older, incomplete and failed API contracts fail closed. The viewer never substitutes a live fit for a rejected result. */
export function canPreviewPart(part:CustomerPart){return part.allowed===true&&!!part.model&&!!part.autoFit;}
