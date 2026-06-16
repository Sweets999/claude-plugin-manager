import os from 'node:os';
import path from 'node:path';

// Single source of truth for every filesystem location cpm touches.
// Everything is overridable via env / args so tests can redirect IO to a tmp dir.
export function resolvePaths({ env = process.env, configOverride, home } = {}) {
  const homeDir = home || env.CPM_HOME || os.homedir();
  const claudeDir = path.join(homeDir, '.claude');
  const config =
    configOverride || env.CPM_CONFIG || path.join(claudeDir, 'cpm.profiles.jsonc');

  return {
    home: homeDir,
    claudeDir,
    settings: path.join(claudeDir, 'settings.json'),
    installedPlugins: path.join(claudeDir, 'plugins', 'installed_plugins.json'),
    // ~/.claude.json — a SIBLING of claudeDir, not inside it. Holds the user's
    // MCP servers under top-level `mcpServers`. cpm does not own this file.
    claudeJson: env.CPM_CLAUDE_JSON || path.join(homeDir, '.claude.json'),
    // Side-store of MCP definitions so cpm can re-enable servers it turned off.
    mcpStore: path.join(claudeDir, 'cpm.mcp-store.json'),
    // Bundled Claude Code skill (auto-installed on global install). Lives under
    // ~/.claude/skills/ so Claude discovers it as a personal skill.
    skillDir: path.join(claudeDir, 'skills', 'cpm'),
    skillFile: path.join(claudeDir, 'skills', 'cpm', 'SKILL.md'),
    config,
    backupsDir: path.join(claudeDir, 'backups'),
    lastPointer: path.join(claudeDir, 'cpm.last.json'),
    lock: path.join(claudeDir, 'cpm.lock'),
    // By default `cpm run` launches `claude` through the user's shell so an
    // alias/function wrapper (and the env it injects) is honored. Setting
    // CPM_CLAUDE_BIN forces a *direct* call to this binary, bypassing any wrapper.
    claudeBin: env.CPM_CLAUDE_BIN || 'claude',
  };
}

// The artifacts cpm creates and is responsible for removing on `uninstall`.
// This is the single source of truth for cleanup: add any future cpm-owned
// file/dir here and `cpm uninstall` (and its dry-run / --json output) picks it
// up automatically — no other code changes needed.
//
//   kind 'file'    -> a single file cpm writes; unlinked on removal.
//   kind 'backups' -> the backups dir; only cpm's own `settings.json.cpm.*.bak`
//                     snapshots are removed, and the dir only if left empty.
//   kind 'skill'   -> the bundled skill file; its `skills/cpm/` dir is removed too
//                     if cpm left it empty.
//   protected      -> user-authored data (the profiles config). Requires an extra
//                     confirmation and is kept unless --purge.
//
// Deliberately NOT listed (cpm does not own these): settings, installedPlugins,
// claudeJson, home, claudeDir, claudeBin.
export function cpmArtifacts(paths) {
  return [
    { key: 'config', path: paths.config, kind: 'file', protected: true },
    { key: 'lastPointer', path: paths.lastPointer, kind: 'file' },
    { key: 'lock', path: paths.lock, kind: 'file' },
    { key: 'mcpStore', path: paths.mcpStore, kind: 'file' },
    { key: 'skill', path: paths.skillFile, kind: 'skill' },
    { key: 'backups', path: paths.backupsDir, kind: 'backups' },
  ];
}
