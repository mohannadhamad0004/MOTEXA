import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNumberText, strictNumber } from '../src/core/constants/numbers.ts';
test('Arabic/Persian digits and decimal separator normalize without deleting invalid text', () => {
  assert.equal(normalizeNumberText('١٥٠٠'), '1500');
  assert.equal(normalizeNumberText('۱۵۰۰٫۵۰'), '1500.50');
  assert.equal(normalizeNumberText('١٢abc'), '12abc');
});
test('price and stock validate full strings, bounds and precision', () => {
  for (const value of ['12abc', '', ' ', '1e3', '0x10', '-1', '1.2.3', 'Infinity', null, {}, true]) assert.equal(strictNumber(value), null);
  for (const value of ['1.9', '12abc', '١٫٩', '2.0']) assert.equal(strictNumber(value, true), null);
  assert.equal(strictNumber('١٥٠٠٫٥٠'), 1500.5);
  assert.equal(strictNumber('۲۴', true), 24);
  assert.equal(strictNumber('0', true), 0);
  assert.equal(strictNumber('12.345'), null);
  assert.equal(strictNumber('1000001', true, 1000000), null);
});
