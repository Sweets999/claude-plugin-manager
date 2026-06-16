import fs from 'node:fs';
import path from 'node:path';
import { parseJsonc, editJsonc } from '../jsonc.js';
import { buildStarterConfig } from './init.js';
import { readEnabledPlugins, readMcpServers, readMcpStore, writeMcpStore } from '../settings.js';
import { mergeStore } from '../mcp.js';
import { enabledList } from '../planner.js';
import { UsageError, CpmError } from '../errors.js';

export default async function save(ctx) {
  const name = ctx.args[0];
  if (!name) throw new UsageError('usage: cpm save <name> [--force]');

  const ids = enabledList(readEnabledPlugins(ctx.paths.settings));

  // Snapshot the currently-live MCP servers too: names go into the profile, and
  // their definitions are merged into the side-store for later re-enabling.
  const live = readMcpServers(ctx.paths.claudeJson);
  const mcpNames = Object.keys(live);

  const cfg = ctx.paths.config;
  const text = fs.existsSync(cfg) ? fs.readFileSync(cfg, 'utf8') : buildStarterConfig([], []);

  const data = parseJsonc(text, { source: cfg });
  if (data.profiles && data.profiles[name] && !ctx.flags.force) {
    throw new CpmError(`Profile "${name}" already exists. Pass --force to overwrite.`, 2);
  }

  // Comment- and order-preserving insert of the new profile node. `mcp` mirrors
  // `plugins`: always present (empty array when nothing is live).
  const next = editJsonc(text, ['profiles', name], { plugins: ids, mcp: mcpNames });
  fs.mkdirSync(path.dirname(cfg), { recursive: true });
  fs.writeFileSync(cfg, next);

  // Keep the store up to date so the saved names have definitions available.
  if (mcpNames.length) {
    writeMcpStore(ctx.paths.mcpStore, mergeStore(readMcpStore(ctx.paths.mcpStore), live));
  }

  const pluginPart = `${ids.length} plugin${ids.length === 1 ? '' : 's'}`;
  const mcpPart = `${mcpNames.length} MCP server${mcpNames.length === 1 ? '' : 's'}`;
  ctx.ui.success(`Saved profile "${name}" (${pluginPart}, ${mcpPart}) to ${cfg}`);
  return 0;
}
