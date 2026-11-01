// "My car": ONE store for the whole customer app. It lives on the account (GET/PUT/DELETE /catalog/my-car), so it survives a
// reload and a new login, and every screen that calls useMyCar() re-renders the moment it changes anywhere. Set / change it
// only through openMyCarPicker() (the one car sheet, mounted in customer/_layout).
import { useEffect, useSyncExternalStore } from "react";
import { useSessionUser } from "../shared/session";
import { catalogService } from "./catalogService";

/** year is a string ("" = any year) because the browse-another-car filter may leave it out; my car always has one */
export type Car = { make: string; model: string; year: string; trim: string; color?: string | null; bodyType?: string | null };

type State = { car: Car | null; userId: string | null; loaded: boolean; pickerOpen: boolean };
let state: State = { car: null, userId: null, loaded: false, pickerOpen: false };
const listeners = new Set<() => void>();
const put = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const toCar = (c: { make: string; model: string; year: number; color?: string | null; bodyType?: string | null } | null): Car | null =>
  c ? { make: c.make, model: c.model, year: String(c.year), trim: "", color: c.color ?? null, bodyType: c.bodyType ?? null } : null;

function loadFor(userId: string) {
  if (state.userId === userId) return;
  put({ userId, car: null, loaded: false });
  catalogService
    .getMyCar()
    .then((c) => state.userId === userId && put({ car: toCar(c), loaded: true }))
    .catch(() => state.userId === userId && put({ loaded: true }));
}

/** The signed-in customer's car (null = none yet), plus whether it has been read from the account. */
export function useMyCar() {
  const user = useSessionUser();
  useEffect(() => loadFor(user.id), [user.id]);
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  return { car: s.userId === user.id ? s.car : null, loaded: s.userId === user.id && s.loaded };
}

/** Save (or clear) the car on the account; every screen updates at once. Throws the server's message on failure. */
export async function saveMyCar(car: { make: string; model: string; year: number; color?: string | null } | null) {
  const saved = car ? await catalogService.putMyCar(car) : await catalogService.deleteMyCar();
  put({ car: toCar(saved) });
}

export const openMyCarPicker = () => put({ pickerOpen: true });
export const closeMyCarPicker = () => put({ pickerOpen: false });
export const useMyCarPickerOpen = () => useSyncExternalStore(subscribe, () => state.pickerOpen, () => state.pickerOpen);

/** Sync read for code outside React render (request forms prefill). */
export const currentCar = () => state.car;
