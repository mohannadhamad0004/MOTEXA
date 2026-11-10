import assert from "node:assert/strict";
import test from "node:test";
import {
  clearLocationMemory,
  getLocationMemory,
  hasMeaningfulMovement,
  isFreshLocation,
  LOCATION_MEMORY_MAX_AGE_MS,
  locationMemory,
  rememberLocation,
} from "../src/core/constants/geo.ts";

test("freshness distinguishes a recent GPS fix from an expired or future timestamp", () => {
  const now = 1_800_000_000_000;
  assert.equal(isFreshLocation(now - 30_000, now), true);
  assert.equal(isFreshLocation(now - 60_001, now), false);
  assert.equal(isFreshLocation(now + 6_000, now), false);
});

test("movement threshold ignores small GPS drift and accepts meaningful travel", () => {
  const start = { lat: 32, lng: 35 };
  assert.equal(hasMeaningfulMovement(start, { lat: 32.00005, lng: 35 }, 20), false);
  assert.equal(hasMeaningfulMovement(start, { lat: 32.001, lng: 35 }, 50), true);
});

test("cached points are scoped to an account, expire, and never appear through legacy unscoped access", () => {
  const now = 1_800_000_000_000;
  const point = { lat: 32.2211, lng: 35.2544 };
  rememberLocation("location-test-a", { point, accuracy: 4, timestamp: now });

  assert.deepEqual(getLocationMemory("location-test-a", now)?.point, point);
  assert.equal(getLocationMemory("location-test-a", now)?.source, "cached");
  assert.equal(getLocationMemory("location-test-b", now), null);
  assert.equal(locationMemory.current, null);
  assert.equal(getLocationMemory("location-test-a", now + LOCATION_MEMORY_MAX_AGE_MS + 1), null);

  rememberLocation("location-test-a", { point, timestamp: now });
  clearLocationMemory("location-test-a");
  assert.equal(getLocationMemory("location-test-a", now), null);
});

import { shouldRefreshLocationRoute } from "../src/core/constants/geo.ts";
import { ACTIVE_LOCATION_DISTANCE_METERS, towRoutePhase, jobAfterLocationError, createLocationLifetime } from "../src/features/shared/locationPolicy.ts";

test("tow destination phase changes refresh the route even within 50 m", () => {
  const from = { lat: 32, lng: 35 }, pickup = { lat: 32.001, lng: 35 };
  const dropoff = { lat: 32.0011, lng: 35 };
  const pickupId = `live:job:${towRoutePhase("EN_ROUTE", true)}`;
  assert.equal(shouldRefreshLocationRoute(null, pickupId, from, pickup, 50), true);
  let anchor = { requestId: pickupId, from, to: pickup };
  const drift = { lat: 32.00001, lng: 35 };
  assert.equal(shouldRefreshLocationRoute(anchor, pickupId, drift, pickup, 50), false);
  const dropoffId = `live:job:${towRoutePhase("IN_PROGRESS", true)}`;
  assert.equal(shouldRefreshLocationRoute(anchor, dropoffId, drift, dropoff, 50), true);
  anchor = { requestId: dropoffId, from: drift, to: dropoff };
  assert.equal(shouldRefreshLocationRoute(anchor, dropoffId, from, dropoff, 50), false);
});

test("active tracking has a small nonzero movement gate", () => {
  assert.ok(ACTIVE_LOCATION_DISTANCE_METERS > 0 && ACTIVE_LOCATION_DISTANCE_METERS <= 10);
});

test("only a 404 removes the job; an expired session (401) and transient failures keep it", () => {
  const job = { status: "ACCEPTED" };
  assert.equal(jobAfterLocationError(job, { status: 404 }), null);
  for (const error of [{ status: 401 }, { status: 403 }, new Error("Network failure"), { status: 500 }, { status: 503 }]) assert.equal(jobAfterLocationError(job, error), job);
});

test("a pending one-shot completion is ignored after cleanup, including a new lifetime", async () => {
  const lifetime = createLocationLifetime();
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  let writes = 0;
  const completion = pending.then(() => { if (lifetime.isActive()) writes++; });
  lifetime.dispose();
  const next = createLocationLifetime();
  resolve();
  await completion;
  assert.equal(writes, 0);
  assert.equal(next.isActive(), true);
});

import { pingWarning } from "../src/features/shared/locationPolicy.ts";
import { isSessionExpiry, expiredText } from "../src/core/session/sessionExpiry.ts";

test("location warning appears after 3 failed pings in a row", () => {
  assert.equal(pingWarning(2), false);
  assert.equal(pingWarning(3), true);
  assert.equal(pingWarning(0), false);
});

test("a 401 with a token is a session expiry; without a token or other codes it is not", () => {
  assert.equal(isSessionExpiry(401, true), true);
  assert.equal(isSessionExpiry(401, false), false);
  assert.equal(isSessionExpiry(403, true), false);
  assert.match(expiredText("ar"), /انتهت/);
  assert.match(expiredText(null), /session expired/);
});

import { ERROR_TEXT, errorTextFor } from "../src/core/session/errorText.ts";

test("server error codes map to English or Arabic text; unknown codes keep the server message", () => {
  assert.match(errorTextFor("DRIVER_NOT_FREE", "ar", "x"), /[؀-ۿ]/);
  assert.equal(errorTextFor("DRIVER_NOT_FREE", null, "x"), "This driver is not free right now.");
  assert.equal(errorTextFor("UNKNOWN_CODE", "ar", "server text"), "server text");
  assert.equal(errorTextFor(undefined, "ar", "server text"), "server text");
  for (const [code, [en, ar]] of Object.entries(ERROR_TEXT)) assert.ok(en && ar && /[؀-ۿ]/.test(ar), code);
});
