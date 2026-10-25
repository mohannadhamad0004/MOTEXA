import { useState } from "react";
import { firstEntry } from "./session";

/** true on the FIRST entry of a main tab in this app session (memory only), false on every later visit. */
export function useIgnition(key: string): boolean {
  const [first] = useState(() => firstEntry(key));
  return first;
}
