import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueSignals } from './value-signals.mjs';
test('technical buzzwords do not demonstrate user value', () => {
  const r = valueSignals('Multimodal agent framework with vision audio text.');
  assert.equal(r.valueSignalScore, 0);
  assert.equal(r.businessValueScore, null);
});
test('actual benefit excerpts remain attributed claims', () => {
  const text = 'Helps teachers transcribe lessons and saves hours of preparation.';
  const r = valueSignals('', text);
  assert.deepEqual(r.taskEvidence, [text]);
  assert.equal(r.valueStatus, '价值线索待核验');
  assert.equal(r.businessValueScore, null);
});
