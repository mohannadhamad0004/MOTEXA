import { Alert } from "react-native";
import { Href, router } from "expo-router";
import { pickPhoto, photoErrorText } from "./pickPhoto";

/** Back, or a fallback route when the screen was opened directly (no history, e.g. deep link / web reload). */
export const goBack = (fallback: Href) => (router.canGoBack() ? router.back() : router.replace(fallback));

/** Picks an image from the library. Returns a local uri, or null if cancelled. */
/** Every form picks through pickPhoto (always a small JPEG); a failure is shown right away in both languages instead of silently doing nothing. */
export async function pickImage(): Promise<string | null> {
  try {
    return (await pickPhoto())?.uri ?? null;
  } catch (e) {
    Alert.alert("MOTEXA", `${photoErrorText(e, (en) => en)}\n${photoErrorText(e, (_en, ar) => ar)}`);
    return null;
  }
}
