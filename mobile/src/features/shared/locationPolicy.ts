// Pure policy shared by production location consumers and regression tests.
export const ACTIVE_LOCATION_DISTANCE_METERS = 5;
export const towRoutePhase = (status: string, hasDropoff: boolean) =>
  status === "IN_PROGRESS" && hasDropoff ? "dropoff" : "pickup";
export function jobAfterLocationError<T>(job: T | null, error: unknown): T | null {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403 || status === 404 ? null : job;
}
export function createLocationLifetime() {
  let active = true;
  return { isActive: () => active, dispose: () => { active = false; } };
}
