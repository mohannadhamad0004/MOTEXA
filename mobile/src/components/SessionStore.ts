// Native credentials remain in SecureStore; browser sessions last only for this tab.
import { Platform } from "react-native";
import * as NativeStore from "expo-secure-store";
export async function getItemAsync(key: string) {
  if (Platform.OS !== "web") return NativeStore.getItemAsync(key);
  return typeof sessionStorage === "undefined"
    ? null
    : sessionStorage.getItem(key);
}
export async function setItemAsync(key: string, value: string) {
  if (Platform.OS !== "web") return NativeStore.setItemAsync(key, value);
  if (typeof sessionStorage === "undefined")
    throw new Error("Browser session unavailable");
  sessionStorage.setItem(key, value);
}
export async function deleteItemAsync(key: string) {
  if (Platform.OS !== "web") return NativeStore.deleteItemAsync(key);
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
}
