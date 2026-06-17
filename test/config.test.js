import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readConfig,
  resolveProfileEntries,
  resolveMcpEntries,
} from '../src/config.js';
import { ConfigError, ProfileNotFoundError } from '../src/errors.js';

const CONFIG = `{
  "version": 1,
  "base": { "plugins": ["base@m"] },
  "profiles": {
    "minimal": { "description": "bare", "plugins": [] },
    "web": { "extends": "minimal", "plugins": ["docker", "playwright@m"] },
    "multi": { "extends": ["minimal", "web"], "plugins": ["extra@m"] },
    "nobase": { "base": false, "plugins": ["only@m"] }
  }
}`;

test('readConfig normalizes shape and defaults', () => {
  const cfg = readConfig(CONFIG);
  assert.equal(cfg.version, 1);
  assert.deepEqual(cfg.base.plugins, ['base@m']);
  assert.ok(cfg.profiles.web);
});

test('rejects non-object top level', () => {
  assert.throws(() => readConfig('[]'), ConfigError);
});

test('rejects missing profiles', () => {
  assert.throws(() => readConfig('{ "version": 1 }'), ConfigError);
});

test('resolveProfileEntries applies base -> parents -> self, deduped', () => {
  const cfg = readConfig(CONFIG);
  assert.deepEqual(resolveProfileEntries(cfg, 'minimal'), ['base@m']);
  assert.deepEqual(resolveProfileEntries(cfg, 'web'), ['base@m', 'docker', 'playwright@m']);
});

test('extends array order is preserved and entries deduped (first wins)', () => {
  const cfg = readConfig(CONFIG);
  // base, then minimal(=base dup), then web(=base dup, docker, playwright@m), then extra@m
  assert.deepEqual(resolveProfileEntries(cfg, 'multi'), [
    'base@m',
    'docker',
    'playwright@m',
    'extra@m',
  ]);
});

test('base:false opts a profile out of the global base', () => {
  const cfg = readConfig(CONFIG);
  assert.deepEqual(resolveProfileEntries(cfg, 'nobase'), ['only@m']);
});

test('unknown profile throws ProfileNotFoundError', () => {
  const cfg = readConfig(CONFIG);
  assert.throws(() => resolveProfileEntries(cfg, 'ghost'), ProfileNotFoundError);
});

test('circular extends is detected', () => {
  const cfg = readConfig(
    '{ "profiles": { "a": { "extends": "b" }, "b": { "extends": "a" } } }',
  );
  assert.throws(() => resolveProfileEntries(cfg, 'a'), (e) => {
    assert.ok(e instanceof ConfigError);
    assert.match(e.message, /[Cc]ircular/);
    return true;
  });
});

// --- MCP config -----------------------------------------------------------

const MCP_CONFIG = `{
  "version": 1,
  "base": { "mcp": ["mbase"] },
  "profiles": {
    "minimal": { "mcp": [] },
    "web": { "extends": "minimal", "mcp": ["docker", "playwright"] },
    "multi": { "extends": ["minimal", "web"], "mcp": ["extra"] },
    "nobase": { "base": false, "mcp": ["only"] }
  }
}`;

test('readConfig defaults base.mcp to [] and reads per-profile mcp arrays', () => {
  const cfg = readConfig('{ "version": 1, "profiles": { "a": {} } }');
  assert.deepEqual(cfg.base, { plugins: [], mcp: [] });
  assert.deepEqual(cfg.base.mcp, []);

  const cfg2 = readConfig(MCP_CONFIG);
  assert.deepEqual(cfg2.base.mcp, ['mbase']);
  assert.deepEqual(cfg2.profiles.web.mcp, ['docker', 'playwright']);
});

test('rejects non-array base.plugins', () => {
  assert.throws(
    () => readConfig('{ "base": { "plugins": "x" }, "profiles": {} }'),
    ConfigError,
  );
});

test('rejects non-array base.mcp', () => {
  assert.throws(
    () => readConfig('{ "base": { "mcp": "x" }, "profiles": {} }'),
    ConfigError,
  );
});

test('rejects legacy base-array / mcpBase format', () => {
  assert.throws(
    () => readConfig('{ "base": ["x"], "profiles": {} }'),
    (e) => {
      assert.ok(e instanceof ConfigError);
      assert.match(e.message, /old "base"\/"mcpBase" format/);
      return true;
    },
  );
  assert.throws(
    () => readConfig('{ "mcpBase": ["x"], "profiles": {} }'),
    (e) => {
      assert.ok(e instanceof ConfigError);
      assert.match(e.message, /old "base"\/"mcpBase" format/);
      return true;
    },
  );
});

test('rejects non-array profile mcp', () => {
  assert.throws(
    () => readConfig('{ "version": 1, "profiles": { "a": { "mcp": "x" } } }'),
    ConfigError,
  );
});

test('resolveMcpEntries applies mcpBase -> parents -> self, deduped', () => {
  const cfg = readConfig(MCP_CONFIG);
  assert.deepEqual(resolveMcpEntries(cfg, 'minimal'), ['mbase']);
  assert.deepEqual(resolveMcpEntries(cfg, 'web'), ['mbase', 'docker', 'playwright']);
  assert.deepEqual(resolveMcpEntries(cfg, 'multi'), [
    'mbase',
    'docker',
    'playwright',
    'extra',
  ]);
});

test('resolveMcpEntries: base:false opts out of mcpBase', () => {
  const cfg = readConfig(MCP_CONFIG);
  assert.deepEqual(resolveMcpEntries(cfg, 'nobase'), ['only']);
});

test('resolveMcpEntries: unknown profile throws ProfileNotFoundError', () => {
  const cfg = readConfig(MCP_CONFIG);
  assert.throws(() => resolveMcpEntries(cfg, 'ghost'), ProfileNotFoundError);
});

test('resolveMcpEntries: circular extends is detected', () => {
  const cfg = readConfig(
    '{ "profiles": { "a": { "extends": "b" }, "b": { "extends": "a" } } }',
  );
  assert.throws(() => resolveMcpEntries(cfg, 'a'), (e) => {
    assert.ok(e instanceof ConfigError);
    assert.match(e.message, /[Cc]ircular/);
    return true;
  });
});

// --- extraArgs -----------------------------------------------------------

test('extraArgs: valid array of strings is preserved', () => {
  const cfg = readConfig(
    '{ "profiles": { "foo": { "extraArgs": ["--dangerously-skip-permissions", "--verbose"] } } }',
  );
  assert.deepEqual(cfg.profiles.foo.extraArgs, ['--dangerously-skip-permissions', '--verbose']);
});

test('extraArgs: empty array is valid', () => {
  const cfg = readConfig('{ "profiles": { "foo": { "extraArgs": [] } } }');
  assert.deepEqual(cfg.profiles.foo.extraArgs, []);
});

test('extraArgs: absent field is absent (no default injected)', () => {
  const cfg = readConfig('{ "profiles": { "foo": {} } }');
  assert.equal(cfg.profiles.foo.extraArgs, undefined);
});

test('extraArgs: non-array throws ConfigError', () => {
  assert.throws(
    () => readConfig('{ "profiles": { "foo": { "extraArgs": "--flag" } } }'),
    ConfigError,
  );
});

test('extraArgs: array with non-string element throws ConfigError', () => {
  assert.throws(
    () => readConfig('{ "profiles": { "foo": { "extraArgs": [42] } } }'),
    ConfigError,
  );
});
