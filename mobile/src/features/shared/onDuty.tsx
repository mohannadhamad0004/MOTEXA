// On-duty location (tow drivers and garage mechanics): while the person is Online, the phone sends its position about every 60 s so
// his company / garage and that department's admins see him on their map (only the latest point is stored on the server; Offline
// clears it). Mounted once in the role's layout, so it keeps going on every screen of that area. FOREGROUND ONLY: Expo Go cannot
// track in the background; that needs a development build with a background location task (docs/guide/05-features.md).
import { useEffect, useSyncExternalStore } from "react";
import type { Point } from "../../core/constants/geo";
import { useLoad } from "../../core/hooks/useLoad";
import { useShareLocation } from "../orders/orderBits";

/** the app-wide Online flag: the home screen sets it the moment the switch changes, the layout re-reads it from the server */
let online = false;
const subs = new Set<() => void>();
export function setDutyOnline(v: boolean) {
  if (v === online) return;
  online = v;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useDutyOnline = () => useSyncExternalStore(subscribe, () => online, () => online);

/** Mounted in a role layout: re-reads "am I online?" every 60 s and, while Online, shares the position about every 60 s. */
export function OnDutySharing({ status, send }: { status: () => Promise<boolean>; send: (p: Point) => Promise<unknown> }) {
  const s = useLoad(status, [], 60_000);
  useEffect(() => { if (s.data !== null) setDutyOnline(s.data); }, [s.data]);
  useEffect(() => () => setDutyOnline(false), []); // leaving the area (log out): stop
  useShareLocation("duty", useDutyOnline(), send, { minMs: 60_000 });
  return null;
}
