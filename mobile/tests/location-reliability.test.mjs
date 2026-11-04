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

test("ownership errors disable the job while transient failures preserve it", () => {
  const job = { status: "ACCEPTED" };
  for (const status of [401, 403, 404]) assert.equal(jobAfterLocationError(job, { status }), null);
  for (const error of [new Error("Network failure"), { status: 500 }, { status: 503 }]) assert.equal(jobAfterLocationError(job, error), job);
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
