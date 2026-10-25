/** Existing tokens without a version remain valid until that account first changes its password. */
export function isCurrentSession(payload: unknown, currentVersion: number) {
  if (!payload || typeof payload !== "object") return false;
  const claim = (payload as { sessionVersion?: unknown }).sessionVersion;
  const version = claim === undefined ? 0 : claim;
  return (
    typeof version === "number" &&
    Number.isSafeInteger(version) &&
    version === currentVersion
  );
}
