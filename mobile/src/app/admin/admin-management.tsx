import { Redirect } from "expo-router";

/** Preserve existing links while keeping administration within the tab shell. */
export default function AdministrationLegacyRoute(){return <Redirect href="/admin/(tabs)/administration"/>;}
