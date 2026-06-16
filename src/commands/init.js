import fs from 'node:fs';
import path from 'node:path';
import { readEnabledPlugins, readMcpServers, writeMcpStore } from '../settings.js';
import { enabledList } from '../planner.js';
import { CpmError } from '../errors.js';

// Starter JSONC config. Seeded with the currently-enabled set when available so
// the first run is immediately useful. Comments are intentional — they survive
// `cpm save`.
export function buildStarterConfig(enabledIds = [], mcpNames = []) {
  const mcpLine = mcpNames.length
    ? `,
      "mcp": [
${mcpNames.map((n) => `        ${JSON.stringify(n)}`).join(',\n')}
      ]`
    : `,
      "mcp": []`;

  const current = enabledIds.length
    ? `,

    // Snapshot of what is enabled right now — rename or trim to taste.
    "current": {
      "description": "Plugins enabled when cpm was initialised",
      "plugins": [
${enabledIds.map((id) => `        ${JSON.stringify(id)}`).join(',\n')}
      ]${mcpLine}
    }`
    : `,

    // Example — replace with your own "name@marketplace" ids:
    // "dev": { "description": "Day-to-day", "plugins": ["docker@acme"], "mcp": ["github"] }`;

  return `{
  // cpm profiles — named sets of Claude Code plugins (and MCP servers). See \`cpm --help\`.
  // Comments and key order are preserved when you run \`cpm save\`.
  "version": 1,

  // Plugins and MCP servers added to EVERY profile (a profile opts out with "base": false).
  "base": {
    "plugins": [],
    "mcp": []
  },

  "profiles": {
    // Bare context — turns everything off.
    "minimal": { "description": "Nothing extra loaded", "plugins": [], "mcp": [] }${current}
  }
}
`;
}

export default async function init(ctx) {
  const cfg = ctx.paths.config;
  if (fs.existsSync(cfg) && !ctx.flags.force) {
    throw new CpmError(
      `Config already exists at ${cfg}. Edit it with \`cpm edit\` (or pass --force to overwrite).`,
      2,
    );
  }
  let enabledIds = [];
  try {
    enabledIds = enabledList(readEnabledPlugins(ctx.paths.settings));
  } catch {
    /* no settings yet — start blank */
  }

  // Seed MCP servers too: the "current" profile gets the names that are live in
  // ~/.claude.json, and the side-store gets their definitions so cpm can later
  // re-enable any it disables.
  let live = {};
  try {
    live = readMcpServers(ctx.paths.claudeJson);
  } catch {
    /* no ~/.claude.json (or unreadable) — start blank */
  }
  const mcpNames = Object.keys(live);

  fs.mkdirSync(path.dirname(cfg), { recursive: true });
  fs.writeFileSync(cfg, buildStarterConfig(enabledIds, mcpNames));
  if (mcpNames.length) writeMcpStore(ctx.paths.mcpStore, live);

  ctx.ui.success(`Wrote ${cfg}`);
  if (mcpNames.length) {
    ctx.ui.info(`Seeded ${mcpNames.length} MCP server${mcpNames.length === 1 ? '' : 's'} into the "current" profile.`);
  }
  ctx.ui.info('Edit it with `cpm edit`, then switch with `cpm use <profile>`.');
  return 0;
}
