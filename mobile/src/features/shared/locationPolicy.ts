// Pure policy shared by production location consumers and regression tests.
export const ACTIVE_LOCATION_DISTANCE_METERS = 5;
export const towRoutePhase = (status: string, hasDropoff: boolean) =>
  status === "IN_PROGRESS" && hasDropoff ? "dropoff" : "pickup";
export function jobAfterLocationError<T>(job: T | null, error: unknown): T | null {
  const status = (error as { status?: number } | null)?.status;
  // Only 404 (a valid session that does not own / no longer has the job) means "gone". 401/403 keep the last job on screen.
  return status === 404 ? null : job;
}
/** Consecutive failed location pings before the driver is warned. */
export const PING_FAILURES_BEFORE_WARNING = 3;
export const pingWarning = (failures: number) => failures >= PING_FAILURES_BEFORE_WARNING;
export function createLocationLifetime() {
  let active = true;
  return { isActive: () => active, dispose: () => { active = false; } };
}
