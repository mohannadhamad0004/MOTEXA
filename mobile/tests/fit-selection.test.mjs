import { test } from 'node:test'; import assert from 'node:assert/strict';
import { ALL_MATCHING, MAX_PICKED, NONE, atLimit, etaText, isSelected, num, rowBlocked, selectedCount, selectionBody, toggle, toggleRows } from '../src/features/accessory3d/fitSelection.ts';

test('bulk fits selection: picked rows are sent as ids, "all matching" as the filter minus unticked rows (never thousands of ids)', () => {
  let s = toggle(toggle(NONE, 'a'), 'b');
  assert.equal(selectedCount(s, 5000), 2); assert.ok(isSelected(s, 'a'));
  assert.deepEqual(selectionBody(s, { make: 'BMW' }), { generationIds: ['a', 'b'] });
  s = toggle(s, 'a'); assert.ok(!isSelected(s, 'a')); assert.equal(selectedCount(s, 5000), 1);
  let all = toggle(ALL_MATCHING, 'x');
  assert.equal(selectedCount(all, 5000), 4999); assert.ok(!isSelected(all, 'x')); assert.ok(isSelected(all, 'anything-else'));
  assert.deepEqual(selectionBody(all, { status: 'passed' }), { filter: { status: 'passed' }, exclude: ['x'] });
  all = toggle(all, 'x'); assert.equal(selectedCount(all, 5000), 5000);
  assert.equal(selectedCount(ALL_MATCHING, 0), 0);
});

test('"Select all" in the header takes the rows on screen, a second tap clears; picking stops at the limit', () => {
  const rows = ['a', 'b', 'c'];
  const s = toggleRows(NONE, rows); assert.equal(selectedCount(s, 99), 3);
  assert.equal(selectedCount(toggleRows(s, rows), 99), 0);
  assert.equal(toggleRows(ALL_MATCHING, rows), NONE, 'from "all matching" the header clears');
  let big = toggleRows(NONE, Array.from({ length: MAX_PICKED + 20 }, (_, i) => `id${i}`));
  assert.equal(selectedCount(big, 9999), MAX_PICKED); assert.ok(atLimit(big));
  big = toggle(big, 'one-more'); assert.ok(!isSelected(big, 'one-more'), 'no more than MAX_PICKED one by one');
});

test('job estimate text: rounded up minutes, hours past 60, nothing before the first car; numbers with separators', () => {
  assert.equal(etaText(null, false), null);
  assert.equal(etaText(30, false), 'less than a minute left');
  assert.equal(etaText(25 * 60 - 10, false), 'about 25 min left');
  assert.equal(etaText(61, false), 'about 2 min left');
  assert.equal(etaText(3600, false), 'about 1 h left');
  assert.equal(etaText(3600 + 5 * 60, false), 'about 1 h 5 min left');
  assert.equal(etaText(25 * 60, true), 'نحو 25 دقيقة متبقية');
  assert.equal(etaText(3600 + 5 * 60, true), 'نحو 1 ساعة و5 دقيقة متبقية');
  assert.equal(num(5000), '5,000'); assert.equal(num(999), '999'); assert.equal(num(1234567), '1,234,567');
});

test('at the limit a checkbox only goes the way the server accepts: "all matching" with 500 left out blocks unticking one more, but an excluded row can be ticked back', () => {
  let all = ALL_MATCHING;
  for (let i = 0; i < MAX_PICKED; i++) all = toggle(all, `x${i}`);
  assert.ok(atLimit(all));
  assert.equal(rowBlocked(all, 'still-selected'), true, 'unticking a 501st car would be ignored: the row is disabled instead');
  assert.equal(rowBlocked(all, 'x0'), false, 'a left-out car can be ticked back');
  let picked = NONE;
  for (let i = 0; i < MAX_PICKED; i++) picked = toggle(picked, `p${i}`);
  assert.equal(rowBlocked(picked, 'p0'), false); assert.equal(rowBlocked(picked, 'other'), true);
  assert.equal(rowBlocked(NONE, 'any'), false);
});
