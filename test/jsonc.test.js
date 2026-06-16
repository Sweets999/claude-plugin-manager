import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonc, editJsonc } from '../src/jsonc.js';
import { ConfigError } from '../src/errors.js';

test('parses JSONC with line + block comments and trailing commas', () => {
  const text = `{
    // a line comment
    "version": 1,
    /* block comment */
    "profiles": {
      "a": { "plugins": ["x@m",] }, // trailing comma inside array
    },
  }`;
  const data = parseJsonc(text);
  assert.equal(data.version, 1);
  assert.deepEqual(data.profiles.a.plugins, ['x@m']);
});

test('does not treat // or commas inside string values as syntax', () => {
  const text = `{ "profiles": { "a": { "description": "see https://x.io, and //notes", "plugins": [] } } }`;
  const data = parseJsonc(text);
  assert.equal(data.profiles.a.description, 'see https://x.io, and //notes');
});

test('throws ConfigError with location on malformed input', () => {
  assert.throws(() => parseJsonc('{ "profiles": { '), (e) => {
    assert.ok(e instanceof ConfigError);
    assert.match(e.message, /\d+:\d+/);
    return true;
  });
});

test('editJsonc inserts a value while preserving comments', () => {
  const text = `{
  // keep me
  "profiles": {
    "a": { "plugins": [] }
  }
}`;
  const next = editJsonc(text, ['profiles', 'b'], { plugins: ['y@m'] });
  assert.match(next, /\/\/ keep me/);
  const data = parseJsonc(next);
  assert.deepEqual(data.profiles.b.plugins, ['y@m']);
  // existing profile untouched
  assert.deepEqual(data.profiles.a.plugins, []);
});
