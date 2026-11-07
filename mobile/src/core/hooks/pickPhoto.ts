import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { rememberPhoto } from "../constants/files";

/** A photo ready to upload: local preview uri + base64 JPEG (what the server stores). */
export type PickedPhoto = { uri: string; base64: string };

/** Which step failed: choosing the photo, converting / shrinking it, or (later) sending it. */
export class PhotoError extends Error {
  constructor(public kind: "pick" | "convert" | "big") {
    super(kind);
  }
}

/**
 * Pick a photo from the library, turn it into a JPEG no wider than 1600 px (quality 0.75) and return it as base64.
 * Whatever the phone gives (JPEG, PNG, HEIC, WEBP) leaves here as JPEG, so the upload is always a type the server accepts and
 * well under its 5 MB limit. No storage permission is asked: the system picker needs none (Android 13+ photo picker, iOS PHPicker).
 * Returns null when cancelled; throws PhotoError(kind) otherwise. The converted photo is remembered by uri so the services
 * can send it without reading the file again.
 */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  let asset: ImagePicker.ImagePickerAsset | undefined;
  try {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false });
    if (r.canceled) return null;
    asset = r.assets[0];
  } catch {
    throw new PhotoError("pick");
  }
  if (!asset) throw new PhotoError("pick");
  try {
    const out = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1600 } }], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    if (!out.base64) throw new Error("empty");
    if (out.base64.length > 6_000_000) throw new PhotoError("big");
    rememberPhoto(out.uri, out.base64);
    return { uri: out.uri, base64: out.base64 };
  } catch (e) {
    if (e instanceof PhotoError) throw e;
    throw new PhotoError("convert");
  }
}

/** The message the user sees for a failure, in the current language (which step failed). */
export const photoErrorText = (e: unknown, t: (en: string, ar: string) => string) => {
  const kind = e instanceof PhotoError ? e.kind : "convert";
  return kind === "pick"
    ? t("We could not open your photos. Check that MOTEXA may access photos in Settings, then try again.", "تعذّر فتح الصور. تأكد من السماح لموتكسا بالوصول إلى الصور من الإعدادات ثم حاول مجددًا.")
    : kind === "big"
      ? t("That photo is too large even after shrinking. Choose a smaller one.", "الصورة كبيرة جدًا حتى بعد التصغير. اختر صورة أصغر.")
      : t("We could not convert that photo. Try another one (JPEG, PNG, WEBP or HEIC).", "تعذّر تحويل الصورة. جرّب صورة أخرى (JPEG أو PNG أو WEBP أو HEIC).");
};

/** Upload failures, with the step named: the request itself failed (network / server) vs the server refused the photo. */
export const uploadErrorText = (e: any, t: (en: string, ar: string) => string) =>
  e?.status === undefined
    ? t("The upload did not reach the server. Check your connection and try again.", "لم يصل الرفع إلى الخادم. تحقق من اتصالك وحاول مجددًا.")
    : e.status === 413
      ? t("The files are too large to send. Use smaller photos.", "الملفات كبيرة جدًا للإرسال. استخدم صورًا أصغر.")
      : (e.message as string);
