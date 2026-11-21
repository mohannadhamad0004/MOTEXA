import { createLocationLifetime } from "./locationPolicy";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { AppState, Platform } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import MotexaDialog from "../../components/MotexaDialog";
import { isFreshLocation, LocationFix, Point, rememberLocation } from "../../core/constants/geo";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Feedback";
import { useL } from "../../core/hooks/useL";
import { getForegroundPermission, hasLocationServices, LocationIssue, openLocationSettings, toLocationFix, watchForegroundLocation, WatchPurpose } from "./locationService";

const TIMEOUT_MS = 20_000;
const SERVICE_CHECK_MS = 15_000;

/** A readable address for a point ("Street, Neighbourhood, City"), or null when the phone cannot tell. */
export async function reverseGeocode(p: Point): Promise<string | null> {
  try {
    const found = await Promise.race([
      Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    const a = found?.[0];
    if (!a) return null;
    const street = [a.street ?? a.name, a.streetNumber].filter(Boolean).join(" ");
    const parts = [street, a.district ?? a.subregion, a.city].filter((x): x is string => !!x && x.trim() !== "");
    return [...new Set(parts)].join(", ") || null;
  } catch {
    return null;
  }
}

type Status = "idle" | "locating" | "ready" | "problem";
type MessagePair = readonly [string, string];
type ProblemState = {
  message: string | null;
  issue: LocationIssue | null;
  canOpenSettings: boolean;
  openSettings: () => Promise<void>;
};

const pair = (en: string, ar: string): MessagePair => [en, ar];

/**
 * One accurate foreground reading, started by a user action. A prompt is only requested while permission is
 * undetermined; after a denial the UI offers settings instead of triggering the native prompt again.
 */
export function useCurrentLocation(
  purpose: "tow-request" | "signup" | "directions" = "tow-request",
  ownerId?: string | null
) {
  const { t } = useL();
  const [status, setStatus] = useState<Status>("idle");
  const [shown, setShown] = useState<MessagePair | null>(null);
  const message = shown ? t(shown[0], shown[1]) : null;
  const [issue, setIssue] = useState<LocationIssue | null>(null);
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [explain, setExplain] = useState(false);
  const answer = useRef<((ok: boolean) => void) | null>(null);
  const lifetime = useRef(createLocationLifetime());
  const inflight = useRef<Promise<Point | null> | null>(null);

  const fail = useCallback((text: MessagePair, cause: LocationIssue, isBlocked = false) => {
    setStatus("problem");
    setShown(text);
    setIssue(cause);
    setBlocked(isBlocked);
    return null;
  }, []);

  const doLocate = useCallback(async (): Promise<Point | null> => {
    const currentLifetime = lifetime.current;
    const alive = currentLifetime.isActive;
    if (!alive()) return null;
    setStatus("locating");
    setShown(null);
    setIssue(null);
    setBlocked(false);
    try {
      let permission = await getForegroundPermission(false);
      if (!alive()) return null;
      if (!permission.granted && permission.status === "undetermined" && permission.canAskAgain) {
        const agreed = await new Promise<boolean>((resolve) => {
          answer.current = resolve;
          setExplain(true);
        });
        if (!alive()) return null;
        if (!agreed) {
          setStatus("idle");
          return null;
        }
        permission = await Location.requestForegroundPermissionsAsync();
        if (!alive()) return null;
      }
      if (!permission.granted) {
        return fail(
          Platform.OS === "web"
            ? pair("Allow location in your browser, or choose a place on the map.", "اسمح بالموقع في المتصفح، أو اختر مكانًا على الخريطة.")
            : permission.canAskAgain
              ? pair("Location permission was denied. Open settings to allow it, or choose a place on the map.", "تم رفض إذن الموقع. افتح الإعدادات للسماح به، أو اختر مكانًا على الخريطة.")
              : pair("Location permission is blocked. Open settings to allow it, or choose a place on the map.", "إذن الموقع محظور. افتح الإعدادات للسماح به، أو اختر مكانًا على الخريطة."),
          "permission-denied",
          !permission.canAskAgain
        );
      }
      const servicesEnabled = await hasLocationServices();
      if (!alive()) return null;
      if (!servicesEnabled) {
        return fail(
          pair("Location is turned off. Turn it on to show your position and live directions.", "الموقع متوقف. شغّله لإظهار موقعك والاتجاهات المباشرة."),
          "services-disabled"
        );
      }

      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
      ]);
      if (!alive()) return null;
      const next = position ? toLocationFix(position) : null;
      if (!next) {
        return fail(
          pair("We could not get a fresh location. Try again, or choose a place on the map.", "تعذّر الحصول على موقع حديث. حاول مرة أخرى، أو اختر مكانًا على الخريطة."),
          "unavailable"
        );
      }
      setFix(next);
      rememberLocation(ownerId, { point: next.point, accuracy: next.accuracy, timestamp: next.timestamp });
      setStatus("ready");
      return next.point;
    } catch {
      if (!alive()) return null;
      return fail(
        pair("We could not get your location. Check that location is on, or choose the place yourself.", "تعذّر الحصول على موقعك. تحقق من تشغيل الموقع، أو اختر المكان بنفسك."),
        "unavailable"
      );
    }
  }, [fail, ownerId]);

  const locate = useCallback((): Promise<Point | null> => {
    if (!inflight.current) {
      inflight.current = doLocate().finally(() => {
        inflight.current = null;
      });
    }
    return inflight.current;
  }, [doLocate]);

  useEffect(() => {
    const current = createLocationLifetime();
    lifetime.current = current;
    return () => { current.dispose(); answer.current?.(false); answer.current = null; };
  }, []);

  const reply = (ok: boolean) => {
    setExplain(false);
    answer.current?.(ok);
    answer.current = null;
  };

  const openSettings = useCallback(async () => {
    const currentLifetime = lifetime.current;
    const opened = issue ? await openLocationSettings(issue) : false;
    if (!currentLifetime.isActive()) return;
    if (!opened) {
      setShown(pair(
        "Open your device or browser settings and allow location for MOTEXA.",
        "افتح إعدادات الجهاز أو المتصفح واسمح لـ MOTEXA باستخدام الموقع."
      ));
    }
  }, [issue]);

  const dialog = (
    <MotexaDialog
      visible={explain}
      type="confirm"
      title={t("Use your location?", "استخدام موقعك؟")}
      message={
        purpose === "directions"
          ? t(
              "Use your location on this map or delivery pin. Any live map updates stop when you leave the map; location is never tracked in the background.",
              "استخدم موقعك على هذه الخريطة أو لتحديد دبوس التوصيل. تتوقف تحديثات الخريطة المباشرة عند مغادرتها، ولا يتم تتبع الموقع في الخلفية."
            )
          : purpose === "signup"
          ? t(
              "MOTEXA reads your location once to register where your business operates. It is not tracked in the background.",
              "يقرأ MOTEXA موقعك مرة واحدة لتسجيل مكان عملك. ولا يتتبعه في الخلفية."
            )
          : t(
              "MOTEXA reads your location while this foreground map is open to find nearby services or mark your car. It is not tracked in the background.",
              "يقرأ MOTEXA موقعك أثناء فتح الخريطة في المقدمة للعثور على الخدمات القريبة أو تحديد مكان سيارتك. ولا يتتبعه في الخلفية."
            )
      }
      confirmText={t("Continue", "متابعة")}
      cancelText={t("Not now", "ليس الآن")}
      onConfirm={() => reply(true)}
      onCancel={() => reply(false)}
    />
  );

  const problemState: ProblemState = {
    message,
    issue,
    canOpenSettings: issue === "permission-denied" || issue === "services-disabled",
    openSettings,
  };
  return {
    status,
    message,
    issue,
    fix,
    blocked,
    canOpenSettings: problemState.canOpenSettings && Platform.OS !== "web",
    locating: status === "locating",
    locate,
    openSettings,
    dialog,
  };
}

type WatchOptions = {
  enabled: boolean;
  ownerId?: string | null;
  initialFix?: LocationFix | null;
  restartKey?: string;
  purpose: WatchPurpose;
  /** Active job screens may request on their first eligible foreground use. A prior denial is never re-prompted. */
  requestIfUndetermined?: boolean;
  onFix?: (fix: LocationFix) => void;
};

/** Focus-bound foreground watcher shared by service maps and active order/tow sharing. */
export function useForegroundLocationWatch({
  enabled,
  ownerId,
  initialFix = null,
  restartKey = "",
  purpose,
  requestIfUndetermined = false,
  onFix,
}: WatchOptions) {
  const { t } = useL();
  const [fix, setFix] = useState<LocationFix | null>(initialFix);
  const [issue, setIssue] = useState<LocationIssue | null>(null);
  const [shown, setShown] = useState<MessagePair | null>(null);
  const [clock, setClock] = useState(Date.now());
  const message = shown ? t(shown[0], shown[1]) : null;

  useEffect(() => {
    setFix(initialFix ?? null);
  }, [initialFix?.timestamp, restartKey]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setIssue(null);
        setShown(null);
        return;
      }
      let alive = true;
      let foreground = AppState.currentState === "active";
      let checking = false;
      let subscription: Location.LocationSubscription | null = null;

      const report = (nextIssue: LocationIssue, text: MessagePair) => {
        if (!alive) return;
        setIssue(nextIssue);
        setShown(text);
      };

      const removeSubscription = () => {
        subscription?.remove();
        subscription = null;
      };

      const checkAndWatch = async () => {
        if (!alive || !foreground || checking) return;
        checking = true;
        try {
          const permission = await getForegroundPermission(requestIfUndetermined);
          if (!alive) return;
          if (!permission.granted) {
            removeSubscription();
            report(
              "permission-denied",
              Platform.OS === "web"
                ? pair("Allow location in your browser to share your live position.", "اسمح بالموقع في المتصفح لمشاركة موقعك المباشر.")
                : pair("Location permission is off. Open settings to allow live location sharing.", "إذن الموقع متوقف. افتح الإعدادات للسماح بمشاركة الموقع المباشر.")
            );
            return;
          }
          if (!(await hasLocationServices())) {
            if (!alive) return;
            removeSubscription();
            report(
              "services-disabled",
              pair("Location is turned off. Turn it on to share your live position.", "الموقع متوقف. شغّله لمشاركة موقعك المباشر.")
            );
            return;
          }
          if (!alive || !foreground || subscription) return;
          setIssue(null);
          setShown(null);
          subscription = await watchForegroundLocation(
            purpose,
            (nextFix) => {
              if (!alive) return;
              setFix(nextFix);
              setClock(Date.now());
              rememberLocation(ownerId, { point: nextFix.point, accuracy: nextFix.accuracy, timestamp: nextFix.timestamp });
              onFix?.(nextFix);
              setIssue(null);
              setShown(null);
            },
            () => {
              removeSubscription();
              report("unavailable", pair("Your location could not be refreshed. The map remains available.", "تعذّر تحديث موقعك. ستبقى الخريطة متاحة."));
            }
          );
          if (!alive || !foreground) removeSubscription();
        } catch {
          if (alive) {
            removeSubscription();
            report("unavailable", pair("Your location could not be read. The map remains available.", "تعذّرت قراءة موقعك. ستبقى الخريطة متاحة."));
          }
        } finally {
          checking = false;
          if (alive) setClock(Date.now());
        }
      };

      void checkAndWatch();
      const timer = setInterval(() => void checkAndWatch(), SERVICE_CHECK_MS);
      const appState = AppState.addEventListener("change", (state) => {
        foreground = state === "active";
        if (foreground) void checkAndWatch();
        else removeSubscription();
      });
      return () => {
        alive = false;
        clearInterval(timer);
        appState.remove();
        removeSubscription();
      };
    }, [enabled, ownerId, purpose, requestIfUndetermined, onFix, restartKey])
  );

  const openSettings = useCallback(async () => {
    const opened = issue ? await openLocationSettings(issue) : false;
    if (!opened) {
      setShown(pair(
        "Open your device or browser settings and allow location for MOTEXA.",
        "افتح إعدادات الجهاز أو المتصفح واسمح لـ MOTEXA باستخدام الموقع."
      ));
    }
  }, [issue]);

  return {
    fix,
    issue,
    message,
    status: !enabled ? "idle" as const : issue ? "problem" as const : "watching" as const,
    fresh: !!fix && fix.source === "gps" && isFreshLocation(fix.timestamp, clock),
    canOpenSettings: (issue === "permission-denied" || issue === "services-disabled") && Platform.OS !== "web",
    openSettings,
  };
}

/** Bilingual recovery notice shared by the map, request and delivery screens. */
export function LocationProblem({ loc }: { loc: ProblemState }) {
  const { t } = useL();
  if (!loc.message) return null;
  return (
    <>
      <Notice tone="danger" icon="location-outline">{loc.message}</Notice>
      {loc.canOpenSettings ? <Button variant="ghost" icon="settings-outline" label={t("Open Settings", "فتح الإعدادات")} onPress={() => void loc.openSettings()} /> : null}
    </>
  );
}
