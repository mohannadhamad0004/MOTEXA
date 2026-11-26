import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_LABELS, STEP_LABELS, carsText, fitsLeftLine, fitsLine, progress } from '../src/features/accessory3d/progress.ts';

const target = { generationId: 'g1', model3dKey: 'bmw-3-series-e36', name: 'BMW E36', nameAr: 'بي إم دبليو', has3d: true, semanticPart: 'WING', partMap: 'NOT_REQUIRED',
  fit: { state: 'APPROVED', current: true, approvedAt: '2026-11-12', reason: null }, previewCurrent: true };
const review = (o = {}) => ({ model: { generated: true, exists: true, optimized: true, keptOriginal: false, validation: 'PASSED', reason: null }, targets: [target],
  publication: { state: 'PRIVATE_CANDIDATE', canPublish: false, blockers: [] }, canRetryProcessing: false, canValidateManual: false, ...o });
const base = { status: 'READY_FOR_FINAL_REVIEW', hasModel: true, partPhotos: [{}], shopModel: null, provider: 'MESHY', providerState: 'SUCCEEDED', resumable: false, mock: false, deactivatedAt: null, review: review() };
const counts = (o = {}) => ({ approved: 0, passed: 0, failed: 0, not_computed: 0, needs_correction: 0, has_correction: 0, ...o });
const states = p => Object.fromEntries(p.steps.map(s => [s.key, s.state]));

test('the published wing: everything done, even though its file was published before optimizing existed (never "not complete")', () => {
  const p = progress({ ...base, status: 'PUBLISHED', review: review({ model: { ...review().model, optimized: false }, publication: { state: 'PUBLISHED', canPublish: false, blockers: [{ code: 'OPTIMIZATION_REQUIRED', message: '' }] } }) }, counts({ approved: 1 }));
  assert.deepEqual(states(p), { photos: 'done', model: 'done', checked: 'done', fits: 'done', published: 'done' });
  assert.equal(p.current, null); assert.equal(p.action, null);
});

test('published rims imported directly: photos skipped, fits left to review = the one next action', () => {
  const p = progress({ ...base, status: 'PUBLISHED', partPhotos: [], provider: 'MANUAL' }, counts({ approved: 18, passed: 1, has_correction: 1, failed: 1 }));
  assert.equal(states(p).photos, 'skipped'); assert.match(p.steps[0].note[0], /imported directly/);
  assert.equal(states(p).fits, 'attention'); assert.equal(states(p).published, 'done');
  assert.equal(p.current, 'fits'); assert.deepEqual(p.action, { kind: 'reviewFits' });
  assert.deepEqual(p.fits, { total: 21, approved: 18, toReview: 2, failed: 1, notComputed: 0 });
  assert.equal(fitsLine(p.fits, false), '21 cars · 18 approved · 2 to review · 1 failed');
  assert.equal(fitsLeftLine(p.fits, false), '2 waiting for your review · 1 failed');
  assert.equal(fitsLine(p.fits, true), '21 سيارة · 18 معتمدة · 2 للمراجعة · 1 فاشلة');
});

test('one current step from photos to publish, each with its own action', () => {
  const pending = progress({ ...base, status: 'PENDING_REVIEW', hasModel: false, review: null }, null);
  assert.equal(pending.current, 'photos'); assert.deepEqual(pending.action, { kind: 'approve' });
  assert.deepEqual(states(pending), { photos: 'now', model: 'todo', checked: 'todo', fits: 'todo', published: 'todo' });
  const shopFile = progress({ ...base, status: 'PENDING_REVIEW', hasModel: false, partPhotos: [], shopModel: { id: 'f' }, review: null }, null);
  assert.equal(states(shopFile).photos, 'skipped'); assert.deepEqual(shopFile.action, { kind: 'useShopModel' });
  assert.deepEqual(progress({ ...base, status: 'APPROVED_FOR_GENERATION', hasModel: false, providerState: null }, null).action, { kind: 'start' });
  assert.deepEqual(progress({ ...base, status: 'APPROVED_FOR_GENERATION', hasModel: false, resumable: true }, null).action, { kind: 'resume' });
  assert.equal(progress({ ...base, status: 'GENERATING', hasModel: false }, null).action, null, 'nothing to press while it is being made');
  const validate = progress({ ...base, provider: 'MANUAL', review: review({ model: { ...review().model, optimized: false, validation: 'NOT_RUN' }, canValidateManual: true }) }, null);
  assert.equal(validate.current, 'checked'); assert.deepEqual(validate.action, { kind: 'validate' });
  const kept = progress({ ...base, review: review({ model: { ...review().model, optimized: false, keptOriginal: true }, publication: { state: 'READY_FOR_FINAL_REVIEW', canPublish: true, blockers: [] } }) }, counts({ approved: 1 }));
  assert.equal(states(kept).checked, 'done'); assert.match(kept.steps[2].note[0], /not needed/i);
  assert.deepEqual(kept.action, { kind: 'publish' });
  const fitReview = progress({ ...base, review: review({ targets: [{ ...target, fit: { ...target.fit, state: 'PASSED', approvedAt: null } }], publication: { state: 'READY_FOR_FINAL_REVIEW', canPublish: false, blockers: [{ code: 'FIT_REVIEW_REQUIRED', message: '' }] } }) }, counts({ passed: 1 }));
  assert.equal(fitReview.current, 'fits'); assert.deepEqual(fitReview.action, { kind: 'reviewFits' });
  const partMap = progress({ ...base, review: review({ targets: [{ ...target, partMap: 'STALE', fit: { ...target.fit, state: 'NOT_RUN' } }], publication: { state: 'x', canPublish: false, blockers: [{ code: 'PART_MAP_STALE', message: '' }] } }) }, counts({ not_computed: 1 }));
  assert.equal(partMap.action.kind, 'partMap'); assert.equal(partMap.action.target.generationId, 'g1');
  const stale = progress({ ...base, review: review({ targets: [{ ...target, previewCurrent: false }], publication: { state: 'x', canPublish: false, blockers: [{ code: 'STALE_VISUAL_REVIEW', message: '' }] } }) }, counts({ approved: 1 }));
  assert.deepEqual(stale.action, { kind: 'preview', generationId: 'g1' });
});

test('rejected and unpublished requests say why; later steps never look started', () => {
  const rejected = progress({ ...base, status: 'REJECTED' }, null);
  assert.equal(rejected.current, 'photos'); assert.equal(rejected.action, null);
  assert.deepEqual(states(rejected), { photos: 'attention', model: 'todo', checked: 'todo', fits: 'todo', published: 'todo' });
  const off = progress({ ...base, status: 'PUBLISHED', deactivatedAt: '2026-11-20' }, counts({ approved: 1 }));
  assert.equal(off.current, 'published'); assert.deepEqual(off.action, { kind: 'reactivate' });
});

test('English and Arabic copy for every step, state and note', () => {
  for (const [en, ar] of [...Object.values(STEP_LABELS), ...Object.values(STATE_LABELS)]) { assert.ok(en); assert.match(ar, /[؀-ۿ]/); }
  assert.equal(carsText(1, true), 'سيارة واحدة'); assert.equal(carsText(3, true), '3 سيارات'); assert.equal(carsText(21, false), '21 cars');
});
