import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readSettings,
  readEnabledPlugins,
  writeEnabledPlugins,
  restore,
  readMcpServers,
  readMcpStore,
  writeMcpStore,
  writeJsonKey,
  applyProfile,
} from '../src/settings.js';
import { SettingsError } from '../src/errors.js';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cpm-test-'));
}

function setup(content) {
  const dir = tmpdir();
  const settings = path.join(dir, 'settings.json');
  if (content != null) fs.writeFileSync(settings, content);
  return {
    dir,
    settings,
    backupsDir: path.join(dir, 'backups'),
    lastPointer: path.join(dir, 'cpm.last.json'),
  };
}

const SAMPLE = JSON.stringify(
  {
    $schema: 'https://example/schema.json',
    permissions: { allow: ['Bash'] },
    enabledPlugins: { 'a@m': true, 'b@m': false },
    model: 'opus',
  },
  null,
  2,
) + '\n';

test('writeEnabledPlugins preserves other keys and their order', () => {
  const { settings, backupsDir, lastPointer } = setup(SAMPLE);
  writeEnabledPlugins(settings, { 'a@m': false, 'b@m': true }, { backupsDir, lastPointer });
  const data = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.deepEqual(Object.keys(data), ['$schema', 'permissions', 'enabledPlugins', 'model']);
  assert.deepEqual(data.permissions, { allow: ['Bash'] });
  assert.equal(data.model, 'opus');
  assert.deepEqual(data.enabledPlugins, { 'a@m': false, 'b@m': true });
});

test('writeEnabledPlugins keeps the original indentation (4 spaces)', () => {
  const four = JSON.stringify({ enabledPlugins: { 'a@m': true } }, null, 4) + '\n';
  const { settings } = setup(four);
  writeEnabledPlugins(settings, { 'a@m': false });
  const raw = fs.readFileSync(settings, 'utf8');
  assert.match(raw, /\n {4}"enabledPlugins"/);
  assert.ok(raw.endsWith('\n'));
});

test('writeEnabledPlugins writes a backup and an undo pointer', () => {
  const { settings, backupsDir, lastPointer } = setup(SAMPLE);
  const { backupPath } = writeEnabledPlugins(
    settings,
    { 'a@m': false },
    { backupsDir, lastPointer, appliedProfile: 'minimal' },
  );
  assert.ok(backupPath && fs.existsSync(backupPath));
  assert.equal(fs.readFileSync(backupPath, 'utf8'), SAMPLE);
  const pointer = JSON.parse(fs.readFileSync(lastPointer, 'utf8'));
  assert.equal(pointer.appliedProfile, 'minimal');
  assert.deepEqual(pointer.previousEnabledPlugins, { 'a@m': true, 'b@m': false });
});

test('restore brings back the previous enabledPlugins and clears the pointer', () => {
  const { settings, backupsDir, lastPointer } = setup(SAMPLE);
  writeEnabledPlugins(settings, { 'a@m': false, 'b@m': true }, { backupsDir, lastPointer });
  restore(settings, { backupsDir, lastPointer });
  assert.deepEqual(readEnabledPlugins(settings), { 'a@m': true, 'b@m': false });
  assert.equal(fs.existsSync(lastPointer), false);
});

test('restore with no pointer throws a friendly error', () => {
  const { settings, lastPointer } = setup(SAMPLE);
  assert.throws(() => restore(settings, { lastPointer }), SettingsError);
});

test('readSettings refuses malformed JSON and write does not clobber it', () => {
  const bad = '{ "enabledPlugins": { ';
  const { settings } = setup(bad);
  assert.throws(() => readSettings(settings), SettingsError);
  assert.throws(() => writeEnabledPlugins(settings, { 'a@m': true }), SettingsError);
  assert.equal(fs.readFileSync(settings, 'utf8'), bad); // untouched
});

test('missing settings file is treated as empty and created', () => {
  const { settings } = setup(null);
  assert.equal(fs.existsSync(settings), false);
  assert.deepEqual(readEnabledPlugins(settings), {});
  writeEnabledPlugins(settings, { 'a@m': true });
  assert.deepEqual(readEnabledPlugins(settings), { 'a@m': true });
});

// --- MCP servers + store ---------------------------------------------------

test('readMcpServers reads mcpServers; missing file -> {}', () => {
  const { dir } = setup();
  const claudeJson = path.join(dir, 'claude.json');
  fs.writeFileSync(
    claudeJson,
    JSON.stringify({ mcpServers: { srv: { command: 'foo' } }, other: 1 }) + '\n',
  );
  assert.deepEqual(readMcpServers(claudeJson), { srv: { command: 'foo' } });
  assert.deepEqual(readMcpServers(path.join(dir, 'nope.json')), {});
});

test('writeMcpStore + readMcpStore round-trips; missing store -> {}', () => {
  const { dir } = setup();
  const store = path.join(dir, 'cpm.mcp-store.json');
  assert.deepEqual(readMcpStore(store), {});
  writeMcpStore(store, { x: { command: 'x', args: ['--y'] } });
  assert.deepEqual(readMcpStore(store), { x: { command: 'x', args: ['--y'] } });
});

test('writeJsonKey mutates only the target key, preserving siblings + order', () => {
  const { settings, backupsDir } = setup(SAMPLE);
  const { backupPath, previous } = writeJsonKey(
    settings,
    'mcpServers',
    { srv: { command: 'foo' } },
    { backupsDir, backupLabel: 'claude.json' },
  );

  const data = JSON.parse(fs.readFileSync(settings, 'utf8'));
  // existing keys kept in order; the new key is appended
  assert.deepEqual(Object.keys(data), [
    '$schema',
    'permissions',
    'enabledPlugins',
    'model',
    'mcpServers',
  ]);
  assert.deepEqual(data.permissions, { allow: ['Bash'] });
  assert.equal(data.model, 'opus');
  assert.deepEqual(data.enabledPlugins, { 'a@m': true, 'b@m': false });
  assert.deepEqual(data.mcpServers, { srv: { command: 'foo' } });

  // previous value of the key (absent -> {}), and a labelled backup written
  assert.deepEqual(previous, {});
  assert.ok(backupPath && fs.existsSync(backupPath));
  assert.match(path.basename(backupPath), /^claude\.json\.cpm\..*\.bak$/);
  assert.equal(fs.readFileSync(backupPath, 'utf8'), SAMPLE);
});

test('applyProfile updates both files and writes a v2 pointer; restore reverts both', () => {
  const dir = tmpdir();
  const settings = path.join(dir, 'settings.json');
  const claudeJson = path.join(dir, 'claude.json');
  const backupsDir = path.join(dir, 'backups');
  const lastPointer = path.join(dir, 'cpm.last.json');
  const lock = path.join(dir, 'cpm.lock');

  fs.writeFileSync(
    settings,
    JSON.stringify({ permissions: { allow: ['Bash'] }, enabledPlugins: { 'a@m': true } }, null, 2) +
      '\n',
  );
  fs.writeFileSync(
    claudeJson,
    JSON.stringify({ numFailures: 3, mcpServers: { old: { command: 'old' } } }, null, 2) + '\n',
  );

  applyProfile(
    [
      {
        filePath: settings,
        key: 'enabledPlugins',
        value: { 'a@m': false, 'b@m': true },
        backupLabel: 'settings.json',
      },
      {
        filePath: claudeJson,
        key: 'mcpServers',
        value: { srv: { command: 'foo' } },
        backupLabel: 'claude.json',
      },
    ],
    { lock, backupsDir, lastPointer, appliedProfile: 'web' },
  );

  // both files updated
  const s1 = JSON.parse(fs.readFileSync(settings, 'utf8'));
  const c1 = JSON.parse(fs.readFileSync(claudeJson, 'utf8'));
  assert.deepEqual(s1.enabledPlugins, { 'a@m': false, 'b@m': true });
  assert.deepEqual(c1.mcpServers, { srv: { command: 'foo' } });
  // sibling keys preserved
  assert.deepEqual(s1.permissions, { allow: ['Bash'] });
  assert.equal(c1.numFailures, 3);

  // a v2 pointer was written
  const pointer = JSON.parse(fs.readFileSync(lastPointer, 'utf8'));
  assert.equal(pointer.version, 2);
  assert.equal(pointer.appliedProfile, 'web');
  assert.ok(Array.isArray(pointer.changes) && pointer.changes.length === 2);

  // restore reverts BOTH files and removes the pointer
  restore(settings, { lastPointer, backupsDir, lock });
  const s2 = JSON.parse(fs.readFileSync(settings, 'utf8'));
  const c2 = JSON.parse(fs.readFileSync(claudeJson, 'utf8'));
  assert.deepEqual(s2.enabledPlugins, { 'a@m': true });
  assert.deepEqual(c2.mcpServers, { old: { command: 'old' } });
  assert.deepEqual(s2.permissions, { allow: ['Bash'] });
  assert.equal(c2.numFailures, 3);
  assert.equal(fs.existsSync(lastPointer), false);
});

test('restore still handles the legacy v1 pointer (back-compat)', () => {
  // writeEnabledPlugins writes a v1 pointer; restore must revert from it.
  const { settings, backupsDir, lastPointer } = setup(SAMPLE);
  writeEnabledPlugins(
    settings,
    { 'a@m': false, 'b@m': true },
    { backupsDir, lastPointer, appliedProfile: 'minimal' },
  );
  const pointer = JSON.parse(fs.readFileSync(lastPointer, 'utf8'));
  assert.equal(pointer.version, undefined, 'v1 pointer has no version field');
  assert.ok(pointer.previousEnabledPlugins, 'v1 shape');

  const res = restore(settings, { backupsDir, lastPointer });
  assert.deepEqual(readEnabledPlugins(settings), { 'a@m': true, 'b@m': false });
  assert.equal(res.restoredProfile, 'minimal');
  assert.equal(fs.existsSync(lastPointer), false);
});
