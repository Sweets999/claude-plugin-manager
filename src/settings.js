import fs from 'node:fs';
import path from 'node:path';
import { SettingsError } from './errors.js';

// Read settings.json as { raw, data }. Missing file -> { raw: null, data: {} }.
// Malformed JSON throws (never silently treated as empty — we must not clobber).
export function readSettings(settingsPath) {
  let raw;
  try {
    raw = fs.readFileSync(settingsPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { raw: null, data: {} };
    throw e;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new SettingsError(
      `${settingsPath} is not valid JSON (${e.message}). ` +
        'Refusing to overwrite; restore from ~/.claude/backups if needed.',
    );
  }
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    throw new SettingsError(`${settingsPath} does not contain a JSON object`);
  }
  return { raw, data };
}

export function readEnabledPlugins(settingsPath) {
  const { data } = readSettings(settingsPath);
  return asPluginMap(data.enabledPlugins);
}

// Low-level primitive: atomically set a single top-level `key` on a JSON file,
// preserving all other keys, their order, and the file's indentation. Optionally
// snapshots the prior raw content into `backupsDir`. NO lock, NO undo pointer —
// callers compose those (see writeEnabledPlugins / applyProfile).
//
// Returns { backupPath, previous } where `previous` is the prior value of `key`
// as a plain object ({} if it was missing or not an object).
export function writeJsonKey(
  filePath,
  key,
  value,
  { backupsDir = null, backupLabel = 'settings.json' } = {},
) {
  const { raw, data } = readSettings(filePath);
  const previous =
    data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])
      ? { ...data[key] }
      : {};
  const indent = raw != null ? sniffIndent(raw) : 2;

  // Spread keeps an existing `key` in its original position; a new key is appended.
  const next = { ...data, [key]: value };
  const content = JSON.stringify(next, null, indent) + '\n';

  let backupPath = null;
  if (raw != null && backupsDir) backupPath = backupRaw(backupsDir, raw, backupLabel);

  ensureDir(path.dirname(filePath));
  atomicWrite(filePath, content);

  return { backupPath, previous };
}

// Atomically set settings.json's `enabledPlugins` to `desired`, preserving all
// other keys, their order, and the file's indentation. Optionally writes a
// timestamped backup and an undo pointer.
export function writeEnabledPlugins(settingsPath, desired, opts = {}) {
  const { backupsDir, lastPointer, lock, appliedProfile = null } = opts;
  const release = lock ? acquireLock(lock) : null;
  try {
    const { backupPath, previous: previousEnabledPlugins } = writeJsonKey(
      settingsPath,
      'enabledPlugins',
      desired,
      { backupsDir },
    );

    if (lastPointer) {
      // Legacy (v1) pointer shape — preserved for back-compat with any
      // standalone plugin-only caller.
      writePointer(lastPointer, {
        backup: backupPath,
        appliedProfile,
        at: new Date().toISOString(),
        previousEnabledPlugins,
      });
    }
    return { backupPath, previousEnabledPlugins };
  } finally {
    if (release) release();
  }
}

// --- MCP store -------------------------------------------------------------

// Read the user's MCP servers from ~/.claude.json -> { name: definition }.
// Missing file -> {}; malformed JSON -> SettingsError (same as readSettings).
export function readMcpServers(claudeJsonPath) {
  return asServerMap(readSettings(claudeJsonPath).data.mcpServers);
}

// Read the cpm side-store of MCP definitions -> { name: definition }.
// On-disk shape is { version: 1, servers: { name: def } }; a bare { name: def }
// map is tolerated. Missing file -> {}; malformed JSON -> SettingsError.
export function readMcpStore(storePath) {
  const { data } = readSettings(storePath);
  if (data && typeof data === 'object' && 'servers' in data) {
    return asServerMap(data.servers);
  }
  return asServerMap(data);
}

// Atomically write the cpm side-store as { version: 1, servers }. No lock,
// no pointer, no backup — cpm owns this file outright.
export function writeMcpStore(storePath, serversMap) {
  ensureDir(path.dirname(storePath));
  const content = JSON.stringify({ version: 1, servers: serversMap }, null, 2) + '\n';
  atomicWrite(storePath, content);
}

// --- multi-file orchestrator ----------------------------------------------

// Apply several single-key writes (plugins + MCPs) under ONE lock with ONE
// combined v2 undo pointer. `specs` = [{ filePath, key, value, backupLabel }].
// Returns { records } where each record is
//   { path, key, backup, previous }.
export function applyProfile(
  specs,
  { lock = null, backupsDir = null, lastPointer = null, appliedProfile = null } = {},
) {
  const release = lock ? acquireLock(lock) : null;
  try {
    const records = [];
    for (const spec of specs) {
      const { backupPath, previous } = writeJsonKey(spec.filePath, spec.key, spec.value, {
        backupsDir,
        backupLabel: spec.backupLabel,
      });
      records.push({
        path: spec.filePath,
        key: spec.key,
        backup: backupPath,
        previous,
      });
    }

    if (lastPointer) {
      writePointer(lastPointer, {
        version: 2,
        appliedProfile,
        at: new Date().toISOString(),
        changes: records,
      });
    }
    return { records };
  } finally {
    if (release) release();
  }
}

// Undo the last write, then clear the pointer. Handles both pointer shapes:
//   v2 ({ changes: [...] }) — reverts every file/key touched by `applyProfile`.
//   v1 ({ previousEnabledPlugins }) — reverts enabledPlugins on `settingsPath`.
export function restore(settingsPath, opts = {}) {
  const { lastPointer, backupsDir, lock } = opts;
  if (!lastPointer) throw new SettingsError('no undo pointer configured');
  let pointer;
  try {
    pointer = JSON.parse(fs.readFileSync(lastPointer, 'utf8'));
  } catch {
    throw new SettingsError('nothing to undo (no previous `cpm use` found)');
  }

  if (Array.isArray(pointer.changes)) {
    // v2: revert each recorded change under one lock. writeJsonKey does NOT
    // lock, so acquiring here is safe (no nested/double lock).
    const release = lock ? acquireLock(lock) : null;
    try {
      for (const change of pointer.changes) {
        writeJsonKey(change.path, change.key, asObj(change.previous), { backupsDir });
      }
    } finally {
      if (release) release();
    }
    try {
      fs.unlinkSync(lastPointer);
    } catch {
      /* already gone */
    }
    return { restoredProfile: pointer.appliedProfile ?? null };
  }

  // v1 (legacy): restore enabledPlugins. writeEnabledPlugins acquires the lock
  // itself, so we must NOT pre-acquire it here (that would deadlock).
  const prev = asPluginMap(pointer.previousEnabledPlugins);
  const res = writeEnabledPlugins(settingsPath, prev, {
    backupsDir,
    lock,
    lastPointer: null,
  });
  try {
    fs.unlinkSync(lastPointer);
  } catch {
    /* already gone */
  }
  return { ...res, restoredProfile: pointer.appliedProfile ?? null };
}

// --- helpers ---------------------------------------------------------------

function asPluginMap(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {};
}

function asServerMap(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {};
}

function asObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function sniffIndent(raw) {
  const m = raw.match(/\n([ \t]+)\S/);
  if (!m) return 2;
  return m[1].includes('\t') ? '\t' : m[1].length;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function atomicWrite(file, content) {
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.cpm-tmp-${process.pid}`,
  );
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

// Snapshot `raw` into the backups dir as `${label}.cpm.${ts}-${pid}.bak`.
// `label` defaults to 'settings.json' so plugin backups keep their filename.
function backupRaw(backupsDir, raw, label = 'settings.json') {
  ensureDir(backupsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupsDir, `${label}.cpm.${ts}-${process.pid}.bak`);
  fs.writeFileSync(file, raw);
  return file;
}

function writePointer(file, obj) {
  ensureDir(path.dirname(file));
  atomicWrite(file, JSON.stringify(obj, null, 2) + '\n');
}

function acquireLock(lockPath, { staleMs = 10000 } = {}) {
  try {
    const fd = fs.openSync(lockPath, 'wx'); // O_CREAT | O_EXCL
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
  } catch (e) {
    if (e.code === 'EEXIST') {
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > staleMs) {
          fs.unlinkSync(lockPath);
          return acquireLock(lockPath, { staleMs });
        }
      } catch {
        /* race: lock vanished; fall through to error */
      }
      throw new SettingsError(
        'another cpm process holds the lock (~/.claude/cpm.lock); retry shortly',
      );
    }
    throw e;
  }
  return () => {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* already released */
    }
  };
}
