import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strictNumber } from '../src/services/numbers.js';
test('API numeric inputs reject prefixes, fractional stock, invalid types and excess precision', () => {
  for (const value of ['12abc', '', null, {}, [], true, NaN, Infinity, '0x10', '1e3', -1, 12.345]) assert.equal(strictNumber(value), null);
  assert.equal(strictNumber('١٥٠٠٫٥٠'), 1500.5);
  assert.equal(strictNumber('۲۴', true), 24);
  assert.equal(strictNumber(1.9, true), null);
  assert.equal(strictNumber('1.9', true), null);
  assert.equal(strictNumber(0, true), 0);
  assert.equal(strictNumber('1000001', true, 1000000), null);
});
