import path from 'node:path';
import { planUninstall, removeCpmFiles } from '../uninstall.js';
import { readMcpServers, readMcpStore, writeJsonKey } from '../settings.js';
import { confirm } from '../prompt.js';

// Servers cpm disabled (defs live in the store, absent from ~/.claude.json).
// Deleting the store would orphan these, so uninstall offers to restore them.
function findOrphanMcp(paths) {
  let store = {};
  let live = {};
  try {
    store = readMcpStore(paths.mcpStore);
  } catch {
    /* no/unreadable store — nothing to orphan */
  }
  try {
    live = readMcpServers(paths.claudeJson);
  } catch {
    /* no/unreadable ~/.claude.json — treat as empty */
  }
  const orphanNames = Object.keys(store).filter(
    (n) => !Object.prototype.hasOwnProperty.call(live, n),
  );
  return { store, live, orphanNames };
}

const NPM_CMD = 'npm uninstall -g claude-plugin-manager';

// Remove everything cpm wrote into ~/.claude, then tell the user the one npm
// command that removes the binary itself. Driven by the cpmArtifacts manifest in
// paths.js, so it needs no changes as new cpm-owned files are added.
export default async function uninstall(ctx) {
  const { paths, flags, ui } = ctx;
  const purge = !!flags.purge;
  const keepConfig = !!flags['keep-config'];

  // The unprotected artifacts (state + backups) are always candidates.
  const plan = planUninstall(paths, { includeProtected: false });
  const unprotected = plan.targets.filter((t) => t.exists);

  // Protected artifacts (the user's profiles config). Decide what happens to them:
  //   keep  -> --keep-config, or --yes without --purge (safe non-interactive default)
  //   purge -> --purge
  //   ask   -> interactive: prompt per entry
  const protectedExisting = planUninstall(paths, { includeProtected: true }).targets.filter(
    (t) => t.protected && t.exists,
  );
  let configAction = 'keep';
  if (protectedExisting.length === 0) configAction = 'none';
  else if (keepConfig) configAction = 'keep';
  else if (purge) configAction = 'purge';
  else if (flags.yes) configAction = 'keep';
  else configAction = 'ask';

  if (flags.json) return reportJson(ctx, configAction === 'purge');

  const hasWork =
    unprotected.length > 0 || configAction === 'purge' || configAction === 'ask';

  // --- report ---
  const willRemove = [...unprotected];
  if (configAction === 'purge') willRemove.push(...protectedExisting);

  if (willRemove.length === 0) {
    ui.info('Nothing to remove — no cpm files to clean up.');
  } else {
    ui.print('cpm will remove:');
    for (const t of willRemove) ui.print(`  ${describe(t)}`);
  }

  ui.info('');
  if (configAction === 'keep') {
    for (const t of protectedExisting) {
      ui.info(`Keeping ${t.path} (your profiles config) — use --purge to remove it too.`);
    }
  } else if (configAction === 'ask') {
    for (const t of protectedExisting) {
      ui.info(`Your profiles config (${t.path}) — you'll be asked whether to delete it.`);
    }
  }
  ui.info(`Leaving untouched: ${paths.settings} (your Claude settings).`);
  if (plan.pointerExists) {
    ui.info('Tip: run `cpm undo` first if you want to restore your previous plugin set.');
  }

  // MCP servers cpm disabled would be orphaned by deleting the store. Surface
  // them up front so the dry-run report mentions the restore offer too.
  const { store, live, orphanNames } = findOrphanMcp(paths);

  if (flags['dry-run']) {
    if (orphanNames.length) {
      ui.info(
        `${orphanNames.length} disabled MCP server${orphanNames.length === 1 ? '' : 's'} ` +
          `would be restored to ${paths.claudeJson} before removing cpm state: ${orphanNames.join(', ')}`,
      );
    }
    ui.info('(dry run — nothing removed)');
    return 0;
  }

  if (!hasWork && orphanNames.length === 0) return 0;

  // --- confirm + remove ---
  if (unprotected.length > 0 && !flags.yes) {
    const ok = await confirm('Remove these cpm files?');
    if (!ok) {
      ui.info('Aborted. (pass --yes to skip this prompt)');
      return 0;
    }
  }

  let includeProtected = configAction === 'purge';
  if (configAction === 'ask') {
    for (const t of protectedExisting) {
      includeProtected = await confirm(
        `Also delete your profiles config (${path.basename(t.path)})?`,
      );
    }
  }

  // Restore orphaned MCP servers BEFORE the store file is unlinked, otherwise
  // their definitions are lost.
  if (orphanNames.length) {
    ui.warn(
      `cpm has ${orphanNames.length} disabled MCP server${orphanNames.length === 1 ? '' : 's'} ` +
        `in its store, absent from ${paths.claudeJson}: ${orphanNames.join(', ')}`,
    );
    const restore =
      flags.yes ||
      (await confirm(
        `Restore ${orphanNames.length} disabled MCP server${orphanNames.length === 1 ? '' : 's'} to ${path.basename(paths.claudeJson)} before removing cpm state?`,
      ));
    if (restore) {
      writeJsonKey(
        paths.claudeJson,
        'mcpServers',
        { ...live, ...Object.fromEntries(orphanNames.map((n) => [n, store[n]])) },
        { backupsDir: paths.backupsDir, backupLabel: 'claude.json' },
      );
      ui.success(`Restored ${orphanNames.length} MCP server${orphanNames.length === 1 ? '' : 's'} to ${paths.claudeJson}.`);
    } else {
      ui.info('Not restoring — those MCP server definitions will be lost.');
    }
  }

  const res = removeCpmFiles(paths, { includeProtected });

  ui.success(`Removed ${res.removed.length} cpm file${res.removed.length === 1 ? '' : 's'}.`);
  if (res.skippedProtected.length) {
    ui.info(
      `Kept your profiles config (${res.skippedProtected
        .map((p) => path.basename(p))
        .join(', ')}). Use --purge to remove it too.`,
    );
  }
  ui.info('');
  ui.info(`To remove the cpm binary itself, run:\n  ${NPM_CMD}`);
  ui.info('(installed from source with `npm link`? use `npm rm -g claude-plugin-manager`.)');
  return 0;
}

function describe(t) {
  if (t.kind === 'backups') {
    const n = t.files.length;
    const bits = [];
    if (n > 0) bits.push(`${n} backup${n === 1 ? '' : 's'}`);
    if (t.removeDir) bits.push('empty dir');
    return `${t.path}  (${bits.join(' + ')})`;
  }
  return t.protected ? `${t.path}  (your profiles config)` : t.path;
}

function reportJson(ctx, includeProtected) {
  const { paths, ui } = ctx;
  const plan = planUninstall(paths, { includeProtected });
  const { orphanNames } = findOrphanMcp(paths);
  if (ctx.flags['dry-run']) {
    ui.data({
      wouldRemove: plan.targets.filter((t) => t.exists).map((t) => t.path),
      mcpWouldRestore: orphanNames,
      settingsUntouched: true,
      pointerExists: plan.pointerExists,
      npmCommand: NPM_CMD,
    });
    return 0;
  }
  const res = removeCpmFiles(paths, { includeProtected });
  ui.data({
    removed: res.removed,
    kept: res.skippedProtected,
    mcpWouldRestore: orphanNames,
    settingsUntouched: true,
    npmCommand: NPM_CMD,
  });
  return 0;
}
