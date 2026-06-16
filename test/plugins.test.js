import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUniverse, resolveEntries, pluginName } from '../src/plugins.js';
import { AmbiguousPluginError } from '../src/errors.js';

test('pluginName splits on @', () => {
  assert.equal(pluginName('core@acme'), 'core');
  assert.equal(pluginName('bare'), 'bare');
});

test('getUniverse from CLI json (array) unioned with enabledPlugins keys', () => {
  const cli = JSON.stringify([
    { id: 'a@m1', enabled: true },
    { id: 'b@m2', enabled: false },
  ]);
  const u = getUniverse({
    claudeListJson: cli,
    enabledPlugins: { 'b@m2': false, 'c@m1': false },
  });
  assert.deepEqual([...u].sort(), ['a@m1', 'b@m2', 'c@m1']);
});

test('getUniverse falls back to installed_plugins.json when CLI absent', () => {
  const installed = JSON.stringify({ plugins: { 'x@m': [{ scope: 'user' }], 'y@m': [] } });
  const u = getUniverse({ claudeListJson: null, installedPluginsJson: installed });
  assert.deepEqual([...u].sort(), ['x@m', 'y@m']);
});

test('resolveEntries resolves a bare name with one universe match', () => {
  const u = new Set(['docker@acme', 'slack@official']);
  const { resolved, unknown } = resolveEntries(['docker'], u);
  assert.deepEqual(resolved, ['docker@acme']);
  assert.deepEqual(unknown, []);
});

test('resolveEntries throws on ambiguous bare name', () => {
  const u = new Set(['ctx@a', 'ctx@b']);
  assert.throws(() => resolveEntries(['ctx'], u), AmbiguousPluginError);
});

test('resolveEntries: unknown bare name is dropped and reported', () => {
  const u = new Set(['a@m']);
  const { resolved, unknown } = resolveEntries(['ghost'], u);
  assert.deepEqual(resolved, []);
  assert.deepEqual(unknown, ['ghost']);
});

test('resolveEntries: unknown fully-qualified id is kept but reported', () => {
  const u = new Set(['a@m']);
  const { resolved, unknown } = resolveEntries(['future@m'], u);
  assert.deepEqual(resolved, ['future@m']);
  assert.deepEqual(unknown, ['future@m']);
});
