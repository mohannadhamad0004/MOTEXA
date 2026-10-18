import { Point } from "../../core/constants/geo";

// react-native-maps does not run on the web build, so maps are simply left out there (the screens still show the text).

export const MAPS_AVAILABLE = false;

export type Pin = { id: string; name: string; lat: number; lng: number; free: boolean };

export function CompaniesMap(_props: { pins: Pin[]; me: Point | null; selectedId: string | null; onSelect: (id: string) => void; height?: number }) {
  return null;
}
export function PinMap(_props: { point: Point; onChange?: (p: Point) => void; height?: number }) {
  return null;
}
export function TripMap(_props: { pickup: Point; dropoff?: Point | null; height?: number }) {
  return null;
}
