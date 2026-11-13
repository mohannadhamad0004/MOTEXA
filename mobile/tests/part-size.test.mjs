import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeSize, sizeMismatches } from '../src/features/accessory3d/partSize.ts';

test('8 points give the extents in mm; fewer give nothing', () => {
  const pts = [[-0.8, 0.2, -2.3], [0.8, 0.2, -2.3], [-0.7, 0.55, -2.1], [0.7, 0.55, -2.1], [-0.85, 0.15, -2.33], [0.85, 0.15, -2.33], [-0.8, 0.4, -2.35], [0.8, 0.4, -2.35]];
  assert.deepEqual(shapeSize(pts), { widthMm: 1700, heightMm: 400, depthMm: 250 });
  assert.equal(shapeSize(pts.slice(0, 7)), null);
});
test('only dimensions off by more than 15 % are flagged; side skirts swap axes', () => {
  const m = { widthMm: 1700, heightMm: 400, depthMm: 250 };
  assert.deepEqual(sizeMismatches('REAR_BUMPER', { widthMm: 1650, heightMm: 470, depthMm: null, lengthMm: null }, m), [{ field: 'heightMm', shop: 470, measured: 400 }]);
  assert.deepEqual(sizeMismatches('REAR_BUMPER', { widthMm: 1955, heightMm: 460, depthMm: 287, lengthMm: null }, m), []);
  assert.deepEqual(sizeMismatches('SIDE_SKIRTS', { widthMm: null, heightMm: null, depthMm: 120, lengthMm: 2000 }, { widthMm: 110, heightMm: 150, depthMm: 2050 }), []);
});
