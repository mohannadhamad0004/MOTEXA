import { ACTIVE_LOCATION_DISTANCE_METERS } from "./locationPolicy";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import { isValidPoint, LocationFix, Point } from "../../core/constants/geo";

export type LocationIssue = "permission-denied" | "services-disabled" | "unavailable";
export type WatchPurpose = "map" | "active";

export const LOCATION_WATCH_OPTIONS: Record<WatchPurpose, Location.LocationOptions> = {
  // The nearby map is not a tracking screen: keep the listener light and ignore tiny GPS drift.
  map: { accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false, timeInterval: 20_000, distanceInterval: 20 },
  // Android: minimum 10 seconds plus 5 m movement. iOS: 5 m movement (timeInterval is Android-only).
  // there is no background service and the subscription is removed when its screen loses focus.
  active: { accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false, timeInterval: 10_000, distanceInterval: ACTIVE_LOCATION_DISTANCE_METERS },
};

export function toLocationFix(position: Location.LocationObject, source: LocationFix["source"] = "gps"): LocationFix | null {
  const point: Point = { lat: position.coords.latitude, lng: position.coords.longitude };
  if (!isValidPoint(point)) return null;
  const timestamp = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
  const accuracy = position.coords.accuracy;
  return {
    point,
    ...(typeof accuracy === "number" && Number.isFinite(accuracy) ? { accuracy } : {}),
    timestamp,
    source,
  };
}

/** Request only when the OS still reports permission as undecided. A prior denial is handled in UI. */
export async function getForegroundPermission(requestIfUndetermined: boolean) {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && requestIfUndetermined && permission.status === "undetermined" && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  return permission;
}

export const hasLocationServices = () => Location.hasServicesEnabledAsync();

export function watchForegroundLocation(
  purpose: WatchPurpose,
  onFix: (fix: LocationFix) => void,
  onError: (message: string) => void
) {
  return Location.watchPositionAsync(
    LOCATION_WATCH_OPTIONS[purpose],
    (position) => {
      const fix = toLocationFix(position);
      if (fix) onFix(fix);
    },
    onError
  );
}

/** Opens the Android high-accuracy provider prompt for a disabled location service, then app settings as fallback. */
export async function openLocationSettings(issue: LocationIssue): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (issue === "services-disabled" && Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
      if (await Location.hasServicesEnabledAsync()) return true;
    } catch {
      // The user can decline the provider prompt; offer the app settings fallback below.
    }
  }
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
