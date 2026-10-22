import * as ImagePicker from "expo-image-picker";
import { Href, router } from "expo-router";

/** Back, or a fallback route when the screen was opened directly (no history, e.g. deep link / web reload). */
export const goBack = (fallback: Href) => (router.canGoBack() ? router.back() : router.replace(fallback));

/** Picks an image from the library. Returns a local uri, or null if cancelled. */
export async function pickImage(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
  return r.canceled ? null : r.assets[0].uri;
}
