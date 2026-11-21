import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoLatin, rtl } from '../src/core/constants/bidi.ts';
const L = '⁦', P = '⁩';
test('Latin runs inside Arabic are isolated as one run each', () => {
  assert.equal(isoLatin('مرسيدس الفئة C W203'), `مرسيدس الفئة ${L}C W203${P}`);
  assert.equal(isoLatin('مثل BMW الفئة 3'), `مثل ${L}BMW${P} الفئة ${L}3${P}`);
  assert.equal(isoLatin('2000–2007'), `${L}2000–2007${P}`);
  assert.equal(isoLatin('بلا رموز'), 'بلا رموز');
  assert.equal(rtl('أ'), '⁧أ⁩');
});
