// First-entry tracking is in memory only (resets on app restart, never persisted).
const seen = new Set<string>();

/** true the first time `key` is asked for in this app session, false afterwards */
export function firstEntry(key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

/** dev motion lab: forget a key so it can replay */
export const resetEntry = (key: string) => void seen.delete(key);
