import fs from 'node:fs';
import path from 'node:path';
import { cpmArtifacts } from './paths.js';

// Only cpm's own snapshots match this (settings.json.cpm.*.bak and
// claude.json.cpm.*.bak); anything else a user left in ~/.claude/backups/ is
// never touched.
const BACKUP_RE = /\.cpm\..*\.bak$/;

// Inspect the filesystem and report what `cpm uninstall` would remove. Pure
// reads only (existsSync / readdirSync); never mutates. Drives entirely off the
// cpmArtifacts manifest, so new cpm-owned paths are covered automatically.
//
// Returns { targets: [{ key, path, kind, exists, protected, files? }], pointerExists }
// where `files` (for kind 'backups') is the list of cpm .bak snapshots found.
export function planUninstall(paths, { includeProtected = false } = {}) {
  const targets = [];
  for (const a of cpmArtifacts(paths)) {
    if (a.protected && !includeProtected) continue;

    if (a.kind === 'backups') {
      const files = listBackups(a.path);
      const dirExists = fs.existsSync(a.path);
      // remove the dir itself only if cleaning the snapshots leaves it empty
      const removeDir = dirExists && isDirEmptyExcept(a.path, files);
      targets.push({
        key: a.key,
        path: a.path,
        kind: a.kind,
        protected: !!a.protected,
        // "something will happen" = there are cpm snapshots to delete, or the
        // dir is ours-and-empty and we'd remove it. Keeps plan == action.
        exists: files.length > 0 || removeDir,
        files,
        removeDir,
      });
    } else {
      targets.push({
        key: a.key,
        path: a.path,
        kind: a.kind,
        protected: !!a.protected,
        exists: fs.existsSync(a.path),
      });
    }
  }
  return { targets, pointerExists: fs.existsSync(paths.lastPointer) };
}

// Remove the artifacts cpm owns. Idempotent: missing files are reported under
// `missing`, not errors. Protected entries (the user's config) are removed only
// when includeProtected is set; otherwise their paths are returned in
// `skippedProtected`. Never touches paths.settings.
export function removeCpmFiles(paths, { includeProtected = false } = {}) {
  const removed = [];
  const missing = [];
  const skippedProtected = [];

  for (const a of cpmArtifacts(paths)) {
    if (a.protected && !includeProtected) {
      if (fs.existsSync(a.path)) skippedProtected.push(a.path);
      continue;
    }

    if (a.kind === 'backups') {
      const files = listBackups(a.path);
      for (const f of files) {
        unlink(f) ? removed.push(f) : missing.push(f);
      }
      // drop the dir if cpm emptied it (don't clobber unrelated user files)
      if (fs.existsSync(a.path) && readdirSafe(a.path).length === 0) {
        try {
          fs.rmdirSync(a.path);
          removed.push(a.path);
        } catch {
          /* not empty / race — leave it */
        }
      }
    } else {
      unlink(a.path) ? removed.push(a.path) : missing.push(a.path);
    }
  }

  return { removed, missing, skippedProtected };
}

// --- helpers ---------------------------------------------------------------

function listBackups(dir) {
  return readdirSafe(dir)
    .filter((name) => BACKUP_RE.test(name))
    .map((name) => path.join(dir, name));
}

function isDirEmptyExcept(dir, files) {
  const keep = new Set(files.map((f) => path.basename(f)));
  return readdirSafe(dir).every((name) => keep.has(name));
}

function readdirSafe(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

// Returns true if a file was actually removed, false if it was already gone.
function unlink(file) {
  try {
    fs.unlinkSync(file);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}
