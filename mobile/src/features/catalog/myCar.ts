// Garage is the source of truth; old consumers still see only the active car.
import { useEffect, useSyncExternalStore } from "react";
import { useSessionUser } from "../shared/session";
import { catalogService, type GarageInput } from "./catalogService";
import { createGarageStore } from "./garageStore";
export type { Car } from "./garageStore";
export { MAX_GARAGE_CARS, matchingGarageCars, canAddGarageCar } from "./garageStore";
export const garageStore = createGarageStore(catalogService);
export function useGarage() {
  const user = useSessionUser();
  const s = useSyncExternalStore(garageStore.subscribe, garageStore.getSnapshot, garageStore.getSnapshot);
  useEffect(() => { void garageStore.hydrate(user.id); }, [user.id]);
  return s.userId === user.id ? s : { ...s, garageCars: [], activeCar: null, loaded: false, loading: true, error: null };
}
export function useMyCar() { const s = useGarage(); return { car: s.activeCar, loaded: s.loaded }; }
export const useActiveCar = () => useGarage().activeCar;
export const currentCar = () => garageStore.getSnapshot().activeCar;
export const refreshGarage = () => garageStore.refresh();
export const activateCar = (id: string) => garageStore.activate(id);
export const addGarageCar = (input: GarageInput) => garageStore.add(input);
export const updateGarageCar = (id: string, input: Partial<GarageInput>) => garageStore.update(id, input);
export const deleteGarageCar = (id: string) => garageStore.remove(id);

type Picker = { mode: "select" } | { mode: "add"; draft?: GarageInput } | { mode: "edit"; id: string } | null;
let picker: Picker = null;
const listeners = new Set<() => void>();
const show = (next: Picker) => { picker = next; listeners.forEach(l => l()); };
export const openMyCarPicker = () => show({ mode: "select" });
export const openAddGarageCar = (draft?: GarageInput) => show({ mode: "add", draft });
export const openEditGarageCar = (id: string) => show({ mode: "edit", id });
export const closeMyCarPicker = () => show(null);
const subscribePicker = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const pickerSnapshot = () => picker;
export const useGaragePicker = () => useSyncExternalStore(subscribePicker, pickerSnapshot, pickerSnapshot);

export function garageError(error: unknown, t: (en: string, ar: string) => string) {
  const e = error as { message?: string; data?: { code?: string } };
  const code = e?.data?.code ?? e?.message;
  if (code === "GARAGE_LIMIT_REACHED") return t("You've reached the 10-car Garage limit.", "وصلت إلى الحد الأقصى للكراج: 10 سيارات.");
  if (code === "GARAGE_ALREADY_SAVED") return t("This car is already saved. Choose it from your Garage.", "هذه السيارة محفوظة بالفعل. اخترها من كراجك.");
  if (code === "GARAGE_BUSY") return t("Please wait for the current change to finish.", "انتظر حتى يكتمل التغيير الحالي.");
  if (code === "GARAGE_CAR_NOT_FOUND") return t("This car is no longer in your Garage. Refresh and try again.", "لم تعد هذه السيارة في كراجك. حدّث القائمة وحاول مجددًا.");
  if (code === "GARAGE_INVALID_CAR") return t("Check the vehicle, year, generation, nickname and colour.", "تحقق من المركبة والسنة والجيل والاسم واللون.");
  return t("Could not update your Garage. Check your connection and try again.", "تعذّر تحديث كراجك. تحقق من اتصالك وحاول مجددًا.");
}
