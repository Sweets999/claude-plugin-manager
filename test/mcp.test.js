import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMcpUniverse, mergeStore, resolveMcpNames } from '../src/mcp.js';
import { parsePluginMcpNames } from '../src/discover.js';

test('getMcpUniverse returns the union of store + live names as a Set', () => {
  const u = getMcpUniverse({
    storeServers: { a: {}, b: {} },
    liveServers: { b: {}, c: {} },
  });
  assert.ok(u instanceof Set);
  assert.deepEqual([...u].sort(), ['a', 'b', 'c']);
});

test('getMcpUniverse handles missing inputs', () => {
  assert.deepEqual([...getMcpUniverse()], []);
  assert.deepEqual([...getMcpUniverse({ storeServers: { a: {} } })], ['a']);
});

test('mergeStore: live wins on conflicts and inputs are not mutated', () => {
  const store = { a: { command: 'store-a' }, b: { command: 'store-b' } };
  const live = { b: { command: 'live-b' }, c: { command: 'live-c' } };
  const merged = mergeStore(store, live);

  assert.deepEqual(merged, {
    a: { command: 'store-a' },
    b: { command: 'live-b' },
    c: { command: 'live-c' },
  });
  // inputs untouched
  assert.deepEqual(store, { a: { command: 'store-a' }, b: { command: 'store-b' } });
  assert.deepEqual(live, { b: { command: 'live-b' }, c: { command: 'live-c' } });
});

test('resolveMcpNames: known names resolve, unknown reported, no throwing', () => {
  const universe = new Set(['a', 'b']);
  const { resolved, unknown } = resolveMcpNames(['a', 'b', 'x'], universe);
  assert.deepEqual(resolved, ['a', 'b']);
  assert.deepEqual(unknown, ['x']);
});

test('resolveMcpNames dedupes both resolved and unknown (first-seen order)', () => {
  const universe = new Set(['a']);
  const { resolved, unknown } = resolveMcpNames(['a', 'a', 'x', 'x'], universe);
  assert.deepEqual(resolved, ['a']);
  assert.deepEqual(unknown, ['x']);
});

test('parsePluginMcpNames extracts only plugin:-prefixed names, deduped', () => {
  const sample = [
    'Checking MCP server health…',
    '',
    'plugin:acme:kubernetes: ... - connected',
    'docker: stdio - connected',
    'plugin:slack:slack: ... - connected',
    'plugin:acme:kubernetes: ... - connected',
  ].join('\n');
  assert.deepEqual(parsePluginMcpNames(sample), [
    'plugin:acme:kubernetes',
    'plugin:slack:slack',
  ]);
  assert.deepEqual(parsePluginMcpNames(''), []);
});
