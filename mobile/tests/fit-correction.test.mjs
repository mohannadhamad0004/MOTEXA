import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IN_APP_MAX, atBound, axisNumber, isCorrected, nudge, sameAdj, unitOf } from '../src/features/accessory3d/correction.ts';

const NONE = { x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 1 };

test('nudges move 1 mm / 5 mm / 1 cm, turn in degrees, size in percent', () => {
  assert.equal(nudge(NONE, 'y', 1, 'fine').y, 0.001);
  assert.equal(nudge(NONE, 'x', -1, 'mid').x, -0.005);
  assert.equal(nudge(nudge(NONE, 'z', 1, 'coarse'), 'z', 1, 'coarse').z, 0.02);
  assert.equal(axisNumber(nudge(NONE, 'ry', 1, 'mid'), 'ry'), '+1');
  assert.equal(axisNumber(nudge(NONE, 'rx', -1, 'fine'), 'rx'), '−0.25', 'a quarter degree');
  assert.equal(axisNumber(nudge(NONE, 's', 1, 'mid'), 's'), '+0.5');
  assert.equal(axisNumber(nudge(NONE, 'y', 1, 'coarse'), 'y'), '+10');
  assert.equal(axisNumber(NONE, 'x'), '0');
  assert.deepEqual([unitOf('x'), unitOf('rx'), unitOf('s')], ['mm', 'deg', 'pct']);
});

test('nudges stop at the server bounds (±0.5 m, ±0.8 rad, 80–125 %) and the button there is off', () => {
  let a = { ...NONE, x: 0.495 };
  a = nudge(a, 'x', 1, 'coarse'); assert.equal(a.x, 0.5); assert.ok(atBound(a, 'x', 1)); assert.ok(!atBound(a, 'x', -1));
  const big = { ...NONE, s: 1.245 };
  assert.equal(nudge(big, 's', 1, 'coarse').s, 1.25); assert.ok(atBound({ ...NONE, s: 0.8 }, 's', -1));
  assert.equal(nudge({ ...NONE, ry: 0.79 }, 'ry', 1, 'coarse').ry, 0.8);
});

test('corrected / same, and the in-app limit before a background job', () => {
  assert.ok(!isCorrected(NONE)); assert.ok(isCorrected(nudge(NONE, 'y', 1, 'fine')));
  assert.ok(sameAdj(NONE, { ...NONE })); assert.ok(!sameAdj(NONE, { ...NONE, s: 1.001 }));
  assert.equal(IN_APP_MAX, 10);
});
