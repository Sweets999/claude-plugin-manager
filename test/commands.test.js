import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMMANDS, KNOWN_COMMANDS, ALIAS_TO_NAME } from '../src/commands.js';

test('every non-builtin command has a matching src/commands/<name>.js', () => {
  for (const c of COMMANDS) {
    if (c.builtin) continue;
    const file = fileURLToPath(new URL(`../src/commands/${c.name}.js`, import.meta.url));
    assert.ok(existsSync(file), `missing command file for "${c.name}" (${file})`);
  }
});

test('aliases resolve to their canonical name', () => {
  assert.equal(ALIAS_TO_NAME.get('list'), 'ls');
});

test('KNOWN_COMMANDS includes names, aliases, and version', () => {
  assert.ok(KNOWN_COMMANDS.has('ls'));
  assert.ok(KNOWN_COMMANDS.has('list'));
  assert.ok(KNOWN_COMMANDS.has('use'));
  assert.ok(KNOWN_COMMANDS.has('version'));
});
