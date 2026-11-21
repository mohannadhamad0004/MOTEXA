// After sign-in every role lands on its own home (core/session/landing.ts), and that home is a real route under src/app.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { landingFor } from "../src/core/session/landing.ts";

const HOMES = [
  ["CUSTOMER", [], "/customer"],
  ["MECHANIC", [], "/mechanic"],
  ["PARTS_PROVIDER", [], "/provider/parts"],
  ["TOW_PROVIDER", [], "/provider/tow"],
  ["TOW_DRIVER", [], "/driver"],
  ["ADMIN", ["MANAGE_MECHANICS"], "/dept"],
  ["ADMIN", ["MANAGE_TOWING"], "/dept"],
  ["ADMIN", ["MANAGE_SPARE_PARTS"], "/dept"],
  ["ADMIN", ["MANAGE_MECHANICS", "MANAGE_TOWING"], "/dept"],
  ["SUPER_ADMIN", [], "/admin/(tabs)"],
];
/** "/provider/parts" -> src/app/provider/parts/index.tsx or src/app/provider/parts/(tabs)/index.tsx */
const routeExists = (href) => ["/index.tsx", "/(tabs)/index.tsx"].some((end) => existsSync(new URL("../src/app" + href + end, import.meta.url)));

test("every role lands on its own home, and the home exists", () => {
  for (const [role, permissions, home] of HOMES) {
    assert.equal(landingFor(role, permissions), home, `${role} ${permissions}`);
    assert.ok(routeExists(home), `${home} has a screen`);
  }
  assert.equal(new Set(HOMES.filter(([r]) => r !== "ADMIN").map(([, , h]) => h)).size, 6, "no two roles share a home (admins share /dept, scoped by permission)");
});

test("no area for an admin without a department, or an unknown role", () => {
  assert.equal(landingFor("ADMIN", []), null);
  assert.equal(landingFor("SOMETHING_ELSE", ["MANAGE_TOWING"]), null);
});
