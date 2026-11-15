import test from 'node:test';
import assert from 'node:assert/strict';
import { frameTimes, confirmedFacts, validateVideo } from './guidedHomeWalk.js';

test('video sampling covers the clip and stays bounded', () => {
  const times = frameTimes(60, 6);
  assert.equal(times.length, 6);
  assert.ok(times[0] < 1 && times[5] > 55 && times[5] < 60);
  assert.throws(() => frameTimes(61, 6));
  assert.throws(() => frameTimes(Infinity, 6));
  assert.throws(() => frameTimes(5, 0));
});
test('video size and type rejected before decoding', () => {
  assert.throws(() => validateVideo({ size: 101 * 1024 * 1024, type: 'video/mp4' }));
  assert.throws(() => validateVideo({ size: 1, type: 'text/plain' }));
});
test('only explicitly confirmed allowlisted facts leave the review', () => {
  assert.deepEqual(confirmedFacts([
    { field: 'roof', value: 'Metal Roof', confirmed: true },
    { field: 'solar', value: 'Solar PV', confirmed: false },
    { field: 'yearBuilt', value: '2001', confirmed: true },
    { field: 'roof', value: 'fake', confirmed: true },
  ]), { roof: 'Metal Roof' });
});

test('frame extraction releases source URL and samples real decoded frames', async () => {
  const { extractVideoFrames } = await import('./guidedHomeWalk.js');
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let revoked = 0;
  let drawn = 0;
  const seeks = [];
  class Video extends EventTarget {
    duration = 12; videoWidth = 1920; videoHeight = 1080;
    canPlayType() { return 'probably'; }
    load() { if (this.src) queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
    set currentTime(value) { seeks.push(value); queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); }
    pause() {}
    removeAttribute() { this.src = ''; }
  }
  globalThis.document = { createElement: kind => kind === 'video' ? new Video() : {
    getContext: () => ({ drawImage: () => drawn++ }),
    toBlob: callback => callback(new Blob(['frame'], { type: 'image/jpeg' })),
  } };
  URL.createObjectURL = () => 'blob:local-video';
  URL.revokeObjectURL = () => revoked++;
  try {
    const frames = await extractVideoFrames(new File(['video'], 'walk.mp4', { type: 'video/mp4' }), 6);
    assert.equal(frames.length, 6);
    assert.equal(drawn, 6);
    assert.equal(revoked, 1);
    assert.ok(seeks[5] > 11);
    assert.ok(frames.every(frame => frame.type === 'image/jpeg'));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(extractVideoFrames(new File(['video'], 'walk.mp4', { type: 'video/mp4' }), 6, controller.signal), { name: 'AbortError' });
    assert.equal(revoked, 2);
  } finally {
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});

test('batches bound both count and multipart bytes without dropping images', async () => {
  const { imageBatches } = await import('./guidedHomeWalk.js');
  const large = Array.from({ length: 12 }, () => ({ file: { size: 5 * 1024 * 1024 } }));
  const batches = imageBatches(large);
  assert.deepEqual(batches.map(batch => batch.length), [4, 4, 4]);
  assert.equal(batches.flat().length, 12);
  assert.deepEqual(imageBatches(large.map(() => ({ file: { size: 50 } }))).map(batch => batch.length), [6, 6]);
});
