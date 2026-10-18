import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import MotexaDialog from "../../components/MotexaDialog";
import { Point, locationMemory, roundPoint } from "../../core/constants/geo";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Feedback";
import { useL } from "../../core/hooks/useL";

const TIMEOUT_MS = 15000;

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

/**
 * The phone's position, only when the user taps a button. One reading in the foreground: no watching, no background
 * tracking, nothing stored. Before the system permission prompt it shows a short explanation. Put `{loc.dialog}` and
 * `<LocationProblem loc={loc} />` in the screen.
 */
export function useCurrentLocation() {
  const { t } = useL();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [explain, setExplain] = useState(false);
  const answer = useRef<((ok: boolean) => void) | null>(null);

  const problem = (text: string, isBlocked = false) => {
    setStatus("problem");
    setMessage(text);
    setBlocked(isBlocked);
    return null;
  };

  const inflight = useRef<Promise<Point | null> | null>(null);
  const doLocate = useCallback(async (): Promise<Point | null> => {
    setStatus("locating");
    setMessage(null);
    setBlocked(false);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          return problem(t("Location is blocked for MOTEXA. Allow it in the phone settings, or choose the place yourself.", "الموقع محظور لتطبيق MOTEXA. اسمح به من إعدادات الهاتف، أو اختر المكان بنفسك."), true);
        }
        const agreed = await new Promise<boolean>((resolve) => {
          answer.current = resolve;
          setExplain(true);
        });
        if (!agreed) {
          setStatus("idle");
          return null;
        }
        perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          return problem(
            perm.canAskAgain
              ? t("Location permission was not given. You can try again, or choose the place yourself.", "لم يتم منح إذن الموقع. يمكنك المحاولة مرة أخرى، أو اختيار المكان بنفسك.")
              : t("Location is blocked for MOTEXA. Allow it in the phone settings, or choose the place yourself.", "الموقع محظور لتطبيق MOTEXA. اسمح به من إعدادات الهاتف، أو اختر المكان بنفسك."),
            !perm.canAskAgain
          );
        }
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        return problem(t("Location services are off. Turn them on in the phone settings and try again.", "خدمات الموقع متوقفة. شغّلها من إعدادات الهاتف ثم حاول مرة أخرى."));
      }
      setStatus("locating");
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
      ]);
      if (!pos) return problem(t("Finding your location took too long. Try again, or choose the place yourself.", "استغرق تحديد موقعك وقتًا طويلًا. حاول مرة أخرى، أو اختر المكان بنفسك."));
      const p = roundPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      locationMemory.current = p;
      setStatus("ready");
      return p;
    } catch {
      return problem(t("We could not get your location. Check that location is on, or choose the place yourself.", "تعذّر الحصول على موقعك. تأكد من تشغيل الموقع، أو اختر المكان بنفسك."));
    }
  }, [t]);

  // One request at a time: a second tap while one is running gets the same answer. The whole operation counts as busy.
  const locate = useCallback((): Promise<Point | null> => {
    if (!inflight.current) {
      inflight.current = doLocate().finally(() => {
        inflight.current = null;
      });
    }
    return inflight.current;
  }, [doLocate]);

  // Leaving the screen while the explanation is open settles the pending promise.
  useEffect(() => () => { answer.current?.(false); answer.current = null; }, []);

  const reply = (ok: boolean) => {
    setExplain(false);
    answer.current?.(ok);
    answer.current = null;
  };

  const dialog = (
    <MotexaDialog
      visible={explain}
      type="confirm"
      title={t("Use your location?", "استخدام موقعك؟")}
      message={t(
        "MOTEXA reads your location once, only now, to find tow companies near you or to mark where your car is. It is not tracked in the background. It is saved only if you send a tow request.",
        "يقرأ MOTEXA موقعك مرة واحدة فقط الآن، للعثور على شركات السحب القريبة منك أو لتحديد مكان سيارتك. لا يتم تتبعه في الخلفية. ولا يُحفظ إلا إذا أرسلت طلب سحب."
      )}
      confirmText={t("Continue", "متابعة")}
      cancelText={t("Not now", "ليس الآن")}
      onConfirm={() => reply(true)}
      onCancel={() => reply(false)}
    />
  );

  return { status, message, blocked, locating: status === "locating", locate, dialog };
}

/** The reason a location could not be read, with a button to open the phone settings when it is blocked. */
export function LocationProblem({ loc }: { loc: ReturnType<typeof useCurrentLocation> }) {
  const { t } = useL();
  if (!loc.message) return null;
  return (
    <>
      <Notice tone="danger" icon="location-outline">{loc.message}</Notice>
      {loc.blocked ? <Button variant="ghost" icon="settings-outline" label={t("Open settings", "فتح الإعدادات")} onPress={() => Linking.openSettings()} /> : null}
    </>
  );
}
