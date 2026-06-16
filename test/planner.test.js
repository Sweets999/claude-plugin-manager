import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExclusiveSet,
  diff,
  enabledList,
  computeMcpDesired,
  diffMcp,
} from '../src/planner.js';

test('computeExclusiveSet: listed plugins true, everything else explicit false', () => {
  const universe = new Set(['a@m', 'b@m', 'c@m']);
  const current = { 'a@m': true, 'd@m': true };
  const desired = computeExclusiveSet(['a@m', 'b@m'], universe, current);
  assert.deepEqual(desired, {
    'a@m': true,
    'b@m': true,
    'c@m': false,
    'd@m': false, // carried from current so it is explicitly turned off
  });
});

test('computeExclusiveSet includes listed-but-unknown ids as true', () => {
  const desired = computeExclusiveSet(['future@m'], new Set(['a@m']), {});
  assert.equal(desired['future@m'], true);
  assert.equal(desired['a@m'], false);
});

test('diff classifies enable / disable / unchanged', () => {
  const current = { 'a@m': true, 'b@m': true, 'c@m': false };
  const desired = { 'a@m': true, 'b@m': false, 'c@m': true };
  const d = diff(current, desired);
  assert.deepEqual(d.enable, ['c@m']);
  assert.deepEqual(d.disable, ['b@m']);
  assert.deepEqual(d.unchanged, ['a@m']);
});

test('enabledList returns sorted ids whose value is true', () => {
  assert.deepEqual(enabledList({ 'b@m': true, 'a@m': true, 'c@m': false }), ['a@m', 'b@m']);
});

test('computeMcpDesired maps only names present in the store, in order', () => {
  const store = { a: { command: 'a' }, b: { command: 'b' }, c: { command: 'c' } };
  const desired = computeMcpDesired(['c', 'missing', 'a'], store);
  // only known names, preserving selection order; missing is skipped
  assert.deepEqual(Object.keys(desired), ['c', 'a']);
  assert.deepEqual(desired.a, { command: 'a' });
  assert.deepEqual(desired.c, { command: 'c' });
});

test('computeMcpDesired returns {} when nothing matches', () => {
  assert.deepEqual(computeMcpDesired(['x', 'y'], { a: {} }), {});
});

test('diffMcp classifies enable / disable / unchanged by name', () => {
  const d = diffMcp({ a: { command: 'a' }, b: { command: 'b' } }, {
    b: { command: 'b' },
    c: { command: 'c' },
  });
  assert.deepEqual(d.enable, ['c']);
  assert.deepEqual(d.disable, ['a']);
  assert.deepEqual(d.unchanged, ['b']);
});
