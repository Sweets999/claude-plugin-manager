import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readConfig, resolveProfileEntries, resolveMcpEntries } from './config.js';
import { getUniverse, resolveEntries } from './plugins.js';
import { getMcpUniverse, mergeStore, resolveMcpNames } from './mcp.js';
import { readEnabledPlugins, readMcpServers, readMcpStore } from './settings.js';
import {
  computeExclusiveSet,
  diff,
  computeMcpDesired,
  diffMcp,
} from './planner.js';
import { CpmError, StrictValidationError } from './errors.js';

// Read + validate the profiles config, with a friendly nudge when it's absent.
export function loadConfig(ctx) {
  let text;
  try {
    text = fs.readFileSync(ctx.paths.config, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new CpmError(
        `No profiles config at ${ctx.paths.config}. Run \`cpm init\` to create one.`,
        2,
      );
    }
    throw e;
  }
  return readConfig(text, { source: ctx.paths.config });
}

// `claude plugin list --json` text, or null if the CLI isn't available.
export function getClaudeListJson(ctx) {
  try {
    return execFileSync(ctx.paths.claudeBin, ['plugin', 'list', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15000,
    });
  } catch {
    return null;
  }
}

// Parsed CLI entries ([{ id, enabled, scope, ... }]) or null.
export function parseList(claudeListJson) {
  if (!claudeListJson) return null;
  try {
    const parsed = JSON.parse(claudeListJson);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.plugins)) return parsed.plugins;
  } catch {
    /* ignore */
  }
  return null;
}

// The full runtime picture: known plugin universe, current enabled map, and the
// CLI's per-plugin detail (when available).
export function loadPluginState(ctx) {
  const claudeListJson = getClaudeListJson(ctx);
  let installedPluginsJson = null;
  try {
    installedPluginsJson = fs.readFileSync(ctx.paths.installedPlugins, 'utf8');
  } catch {
    /* optional */
  }
  const enabledPlugins = readEnabledPlugins(ctx.paths.settings);
  const universe = getUniverse({ claudeListJson, installedPluginsJson, enabledPlugins });
  return { universe, enabledPlugins, list: parseList(claudeListJson) };
}

// Resolve a profile to a desired enabledPlugins map + a diff vs current state.
export function planProfile(ctx, config, name, { strict = false } = {}) {
  const { universe, enabledPlugins } = loadPluginState(ctx);
  const entries = resolveProfileEntries(config, name);
  const { resolved, unknown } = resolveEntries(entries, universe);
  if (strict && unknown.length) {
    throw new StrictValidationError(
      `profile "${name}" references uninstalled plugin(s): ${unknown.join(', ')}`,
    );
  }
  const desired = computeExclusiveSet(resolved, universe, enabledPlugins);
  return {
    resolved,
    unknown,
    desired,
    enabledPlugins,
    changes: diff(enabledPlugins, desired),
  };
}

// MCP analogue of loadPluginState: the full runtime MCP picture. `live` is what
// is currently in ~/.claude.json; `store` is the cpm side-store; `merged` is the
// superset of definitions (live wins on conflicts); `universe` is every known
// manageable user MCP server name. Plugin-bundled MCPs never appear here.
export function loadMcpState(ctx) {
  const live = readMcpServers(ctx.paths.claudeJson);
  const store = readMcpStore(ctx.paths.mcpStore);
  const merged = mergeStore(store, live); // live wins; superset of defs
  const universe = getMcpUniverse({ storeServers: store, liveServers: live });
  return { live, store, merged, universe };
}

// MCP analogue of planProfile: resolve a profile to the desired user MCP server map
// + a diff vs the live ~/.claude.json state. `desired` defs come from `merged`
// so a server known only to the store (currently disabled) can still be enabled.
export function planMcpProfile(ctx, config, name, { strict = false } = {}) {
  const { live, merged, universe } = loadMcpState(ctx);
  const entries = resolveMcpEntries(config, name);
  const { resolved, unknown } = resolveMcpNames(entries, universe);
  if (strict && unknown.length) {
    throw new StrictValidationError(
      `profile "${name}" references unknown MCP server(s): ${unknown.join(', ')}`,
    );
  }
  const desired = computeMcpDesired(resolved, merged);
  return {
    selected: resolved,
    unknown,
    desired,
    current: live,
    merged,
    changes: diffMcp(live, desired),
  };
}

// Convenience: the combined plan for both axes (plugins + MCP). Each sub-plan
// loads its own state; that's fine — they read disjoint files.
export function planFull(ctx, config, name, { strict = false } = {}) {
  return {
    plugins: planProfile(ctx, config, name, { strict }),
    mcp: planMcpProfile(ctx, config, name, { strict }),
  };
}

// Best-effort `claude mcp list` stdout (no --json exists), or null on any error.
// Used only for cosmetic discovery of plugin-bundled MCP names.
export function getMcpListText(ctx) {
  try {
    return execFileSync(ctx.paths.claudeBin, ['mcp', 'list'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15000,
    });
  } catch {
    return null;
  }
}

// Parse plugin-bundled MCP server names from `claude mcp list` text. Each line
// looks like `name: detail - status`; plugin ones are prefixed `plugin:`
// (e.g. `plugin:acme:kubernetes: ...`). We return the token before the first `: `
// for lines whose name starts with `plugin:`. Best-effort/cosmetic: blank lines
// and a possible health-check header are skipped, and names are deduped.
export function parsePluginMcpNames(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (const rawLine of String(text).split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const idx = line.indexOf(': ');
    if (idx === -1) continue; // header like "Checking MCP server health…"
    const namePart = line.slice(0, idx).trim();
    if (!namePart.startsWith('plugin:')) continue;
    if (!seen.has(namePart)) {
      seen.add(namePart);
      out.push(namePart);
    }
  }
  return out;
}

// Does a higher-precedence settings file in the cwd define enabledPlugins?
// If so, `cpm use` (user scope) won't take effect inside that project.
export function detectProjectOverride(ctx) {
  const candidates = [
    `${ctx.cwd}/.claude/settings.json`,
    `${ctx.cwd}/.claude/settings.local.json`,
  ];
  const hits = [];
  for (const file of candidates) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && typeof data.enabledPlugins === 'object') hits.push(file);
    } catch {
      /* missing or unrelated */
    }
  }
  return hits;
}
