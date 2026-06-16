import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolvePaths, cpmArtifacts } from '../src/paths.js';
import { planUninstall, removeCpmFiles } from '../src/uninstall.js';

// Build a self-contained ~/.claude home in a tmp dir and seed it with the full
// set of files cpm creates, plus a couple of files cpm must never touch.
function setup() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cpm-uninstall-'));
  const paths = resolvePaths({ env: {}, home });
  fs.mkdirSync(paths.claudeDir, { recursive: true });
  fs.mkdirSync(paths.backupsDir, { recursive: true });

  fs.writeFileSync(paths.config, '{ "version": 1, "profiles": {} }');
  fs.writeFileSync(paths.lastPointer, '{}');
  fs.writeFileSync(paths.lock, String(process.pid));
  fs.writeFileSync(paths.mcpStore, '{ "version": 1, "servers": {} }');
  fs.writeFileSync(paths.settings, '{ "enabledPlugins": {} }');

  // cpm-owned backup + an unrelated file a user dropped in backups/
  const ownBak = path.join(
    paths.backupsDir,
    'settings.json.cpm.2026-06-16T00-00-00-000-1.bak',
  );
  const foreign = path.join(paths.backupsDir, 'my-notes.txt');
  fs.writeFileSync(ownBak, 'old');
  fs.writeFileSync(foreign, 'keep me');

  return { home, paths, ownBak, foreign };
}

test('planUninstall lists unprotected targets and reports the pointer', () => {
  const { paths } = setup();
  const plan = planUninstall(paths, { includeProtected: false });

  assert.equal(plan.pointerExists, true);
  const keys = plan.targets.map((t) => t.key).sort();
  // config is protected -> excluded when includeProtected is false.
  // mcpStore is a cpm-owned artifact and is listed.
  assert.deepEqual(keys, ['backups', 'lastPointer', 'lock', 'mcpStore']);
  assert.ok(plan.targets.every((t) => t.exists));
});

test('planUninstall includes protected config when asked', () => {
  const { paths } = setup();
  const plan = planUninstall(paths, { includeProtected: true });
  const cfg = plan.targets.find((t) => t.key === 'config');
  assert.ok(cfg, 'config target present');
  assert.equal(cfg.protected, true);
});

test('removeCpmFiles deletes state + cpm backups, keeps settings.json, config, and foreign files', () => {
  const { paths, ownBak, foreign } = setup();
  const res = removeCpmFiles(paths, { includeProtected: false });

  assert.equal(fs.existsSync(paths.lastPointer), false);
  assert.equal(fs.existsSync(paths.lock), false);
  assert.equal(fs.existsSync(ownBak), false);

  // never touched
  assert.equal(fs.existsSync(paths.settings), true);
  assert.equal(fs.existsSync(paths.config), true);
  assert.equal(fs.existsSync(foreign), true);

  // config was protected and not requested
  assert.ok(res.skippedProtected.includes(paths.config));
  // backups dir survives because the foreign file remains
  assert.equal(fs.existsSync(paths.backupsDir), true);
});

test('removeCpmFiles removes the empty backups dir once cpm snapshots are gone', () => {
  const { paths, foreign } = setup();
  fs.unlinkSync(foreign); // now only cpm's own .bak remains
  removeCpmFiles(paths, { includeProtected: false });
  assert.equal(fs.existsSync(paths.backupsDir), false);
});

test('removeCpmFiles with includeProtected deletes the config too', () => {
  const { paths } = setup();
  const res = removeCpmFiles(paths, { includeProtected: true });
  assert.equal(fs.existsSync(paths.config), false);
  assert.ok(res.removed.includes(paths.config));
});

test('removeCpmFiles is idempotent', () => {
  const { paths } = setup();
  removeCpmFiles(paths, { includeProtected: true });
  // second run must not throw and removes nothing new
  const res = removeCpmFiles(paths, { includeProtected: true });
  assert.deepEqual(res.removed, []);
});

test('planUninstall marks an empty backups dir as removable (plan matches action)', () => {
  const { paths, ownBak, foreign } = setup();
  fs.unlinkSync(ownBak);
  fs.unlinkSync(foreign); // backups dir now exists but is empty
  const plan = planUninstall(paths, { includeProtected: false });
  const backups = plan.targets.find((t) => t.key === 'backups');
  assert.equal(backups.exists, true, 'empty cpm backups dir should be reported');
  assert.equal(backups.removeDir, true);
  // and the action agrees
  removeCpmFiles(paths, { includeProtected: false });
  assert.equal(fs.existsSync(paths.backupsDir), false);
});

test('planUninstall does NOT flag a backups dir that holds only foreign files', () => {
  const { paths, ownBak } = setup();
  fs.unlinkSync(ownBak); // only the foreign file remains
  const plan = planUninstall(paths, { includeProtected: false });
  const backups = plan.targets.find((t) => t.key === 'backups');
  assert.equal(backups.exists, false, 'dir with only user files is left alone');
});

test('BACKUP_RE covers settings + claude.json snapshots and leaves foreign .bak files', () => {
  const { paths } = setup();
  const settingsBak = path.join(
    paths.backupsDir,
    'settings.json.cpm.2026-06-16T00-00-00-000-2.bak',
  );
  const claudeBak = path.join(
    paths.backupsDir,
    'claude.json.cpm.2026-06-16T00-00-00-000-3.bak',
  );
  const foreignBak = path.join(paths.backupsDir, 'foo.bak');
  fs.writeFileSync(settingsBak, 'old settings');
  fs.writeFileSync(claudeBak, 'old claude');
  fs.writeFileSync(foreignBak, 'not ours');

  const plan = planUninstall(paths, { includeProtected: false });
  const backups = plan.targets.find((t) => t.key === 'backups');
  assert.ok(backups.files.includes(settingsBak), 'settings snapshot listed');
  assert.ok(backups.files.includes(claudeBak), 'claude.json snapshot listed');
  assert.ok(!backups.files.includes(foreignBak), 'foreign .bak not listed');

  removeCpmFiles(paths, { includeProtected: false });
  assert.equal(fs.existsSync(settingsBak), false, 'settings snapshot removed');
  assert.equal(fs.existsSync(claudeBak), false, 'claude.json snapshot removed');
  assert.equal(fs.existsSync(foreignBak), true, 'foreign .bak left untouched');
});

test('manifest only ever targets paths under claudeDir and never settings.json', () => {
  const paths = resolvePaths({ env: {}, home: '/tmp/whatever' });
  for (const a of cpmArtifacts(paths)) {
    assert.ok(
      a.path.startsWith(paths.claudeDir + path.sep),
      `${a.key} (${a.path}) must live under ${paths.claudeDir}`,
    );
    assert.notEqual(a.path, paths.settings, 'settings.json must never be a target');
  }
});
