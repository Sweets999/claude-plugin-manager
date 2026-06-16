#!/usr/bin/env node
// Build a hermetic sandbox $HOME for recording cpm demos.
//
// Everything here is FICTIONAL (docker / playwright / jupyter / github / sentry …)
// so the recordings never expose real, company-internal plugins or MCP servers.
// The sandbox is driven entirely through cpm's env overrides (CPM_HOME,
// CPM_CLAUDE_JSON, CPM_CLAUDE_BIN) so the user's real ~/.claude is never touched.
//
// Usage: node scripts/demo/setup.mjs [sandboxDir]
//   defaults to scripts/demo/.sandbox (gitignored)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandbox = path.resolve(process.argv[2] || path.join(here, '.sandbox'));

const claudeDir = path.join(sandbox, '.claude');
const pluginsDir = path.join(claudeDir, 'plugins');
fs.rmSync(sandbox, { recursive: true, force: true });
fs.mkdirSync(pluginsDir, { recursive: true });

const write = (p, obj) =>
  fs.writeFileSync(p, (typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)) + '\n');

// --- The fictional plugin universe (name@marketplace) ---------------------
const PLUGINS = [
  'core@acme',
  'docker@acme',
  'playwright@acme',
  'jupyter@acme',
  'code-review@acme',
];

// installed_plugins.json — the fallback universe source.
write(path.join(pluginsDir, 'installed_plugins.json'), {
  plugins: Object.fromEntries(PLUGINS.map((id) => [id, { enabled: true }])),
});

// What `claude plugin list --json` returns. enabled:false on purpose — cpm
// overlays the real state from settings.json, so this stays accurate after swaps.
write(
  path.join(sandbox, 'plugins-list.json'),
  PLUGINS.map((id) => ({ id, enabled: false, scope: 'user' })),
);

// What `claude mcp list` returns (cosmetic plugin-bundled MCP discovery).
write(
  path.join(sandbox, 'mcp-list.txt'),
  ['plugin:acme:browser: chrome devtools - ✓ connected', ''].join('\n'),
);

// --- Starting state: a bloated context (everything on) --------------------
// settings.json holds enabledPlugins — start with ALL plugins enabled to
// motivate the tool.
write(path.join(claudeDir, 'settings.json'), {
  enabledPlugins: Object.fromEntries(PLUGINS.map((id) => [id, true])),
});

// ~/.claude.json holds the user's MCP servers — start with all four enabled.
write(path.join(sandbox, '.claude.json'), {
  mcpServers: {
    github: { command: 'github-mcp', args: [] },
    sentry: { command: 'sentry-mcp', args: [] },
    postgres: { command: 'pg-mcp', args: [] },
    linear: { command: 'linear-mcp', args: [] },
  },
});

// --- The profiles config --------------------------------------------------
write(
  path.join(claudeDir, 'cpm.profiles.jsonc'),
  `{
  "version": 1,

  // Always on, in every profile.
  "base": { "plugins": ["core@acme"], "mcp": [] },

  "profiles": {
    // Deep work: nothing extra loaded. The leanest possible context.
    "focus": { "description": "Deep work", "base": false, "plugins": [] },

    // Web app development.
    "web": {
      "description": "Web dev",
      "plugins": ["docker", "playwright@acme"],
      "mcp": ["github", "sentry"]
    },

    // Data / notebooks.
    "data": {
      "description": "Data & notebooks",
      "plugins": ["jupyter@acme"],
      "mcp": ["postgres"]
    },

    // Code review: builds on web, adds a reviewer plugin.
    "review": {
      "description": "PR review",
      "extends": "web",
      "plugins": ["code-review@acme"]
    }
  }
}
`,
);

console.log(sandbox);
