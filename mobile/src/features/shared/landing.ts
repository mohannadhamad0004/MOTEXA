import type { Href } from "expo-router";

/**
 * Where a user lands after a successful login, from the role and the admin permissions.
 * Returns null when the account has no area in the app (shown as "not assigned to your department").
 * UX routing only: every area and every API route enforces access again on its own.
 */
export function landingFor(role: string, permissions: string[]): Href | null {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/(tabs)";
    case "ADMIN": {
      const areas = {
        MANAGE_MECHANICS: "/mechanics-admin",
        MANAGE_TOWING: "/admin/tow",
        MANAGE_SPARE_PARTS: "/admin/shops",
      } as const;
      const held = (Object.keys(areas) as (keyof typeof areas)[]).filter((p) => permissions.includes(p));
      if (held.length === 0) return null;
      return held.length === 1 ? areas[held[0]] : "/admin/departments";
    }
    case "TOW_PROVIDER":
      return "/provider/tow";
    case "PARTS_PROVIDER":
      return "/provider/parts";
    case "CUSTOMER":
    case "MECHANIC":
      return "/home";
    default:
      return null;
  }
}
