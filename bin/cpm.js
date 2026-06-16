#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from '../src/cli.js';
import { COMMANDS, ALIAS_TO_NAME } from '../src/commands.js';
import { resolvePaths } from '../src/paths.js';
import { createUi } from '../src/ui.js';
import { CpmError, UsageError } from '../src/errors.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(e instanceof CpmError ? e.exitCode : 2);
}

const { command, args, flags, passthrough } = parsed;
const ui = createUi({
  color: !flags['no-color'],
  quiet: !!flags.quiet,
  json: !!flags.json,
});

async function dispatch() {
  if (command === 'version' || flags.version) {
    ui.print(pkg.version);
    return 0;
  }
  if (command === 'help') {
    printGuide();
    return 0;
  }
  if (flags.help) {
    printHelp();
    return 0;
  }

  const name = ALIAS_TO_NAME.get(command) ?? command;
  const cmdPath = fileURLToPath(new URL(`../src/commands/${name}.js`, import.meta.url));
  if (!existsSync(cmdPath)) throw new UsageError(`Unknown command: ${command}`);

  const ctx = {
    paths: resolvePaths({ env: process.env, configOverride: flags.config }),
    flags,
    args,
    passthrough,
    env: process.env,
    cwd: process.cwd(),
    ui,
  };

  const mod = await import(pathToFileURL(cmdPath));
  return (await mod.default(ctx)) ?? 0;
}

// Render the registry as aligned `cpm <usage>  <summary>` lines. Long usages
// (e.g. `run`) overflow past the padding rather than widening every row.
function commandLines({ flags = false } = {}) {
  const cell = (c) => `  cpm ${c.usage}`;
  const width = Math.max(
    ...COMMANDS.map(cell).filter((s) => s.length <= 26).map((s) => s.length),
  );
  return COMMANDS.map((c) => {
    let line = cell(c).padEnd(width) + '  ' + c.summary;
    if (flags && c.flags.length) line += `  [${c.flags.join('] [')}]`;
    return line;
  }).join('\n');
}

function printHelp() {
  ui.print(`cpm — claude-plugin-manager (v${pkg.version})

Switch between named sets ("profiles") of Claude Code plugins and MCP servers to control context bloat.

Usage:
  cpm <profile>         Run claude with just this profile (isolated; alias of 'run')
${commandLines()}

Flags:
  -n, --dry-run            Show changes without writing (use, uninstall)
  -y, --yes                Skip confirmation (use, uninstall)
      --purge              Also delete your profiles config (uninstall)
      --keep-config        Keep your profiles config (uninstall)
      --strict             Fail if a profile references an uninstalled plugin
      --json               Machine-readable output (read commands)
      --config <path>      Use an alternate profiles config file
      --no-color / --quiet
  -h, --help   -V, --version

Config: ~/.claude/cpm.profiles.jsonc  (override with --config or $CPM_CONFIG)
Tip: \`cpm help\` prints a full, self-contained guide — handy for AI agents.`);
}

// Full, self-contained guide. Designed so an AI agent can run `cpm help` and
// learn everything needed to set up and drive the tool with no other docs.
function printGuide() {
  ui.print(`cpm — claude-plugin-manager (v${pkg.version})
Switch between named "profiles" of Claude Code plugins and MCP servers to control context bloat.

WHAT THIS DOES
  Each enabled Claude Code plugin loads MCP servers + skills that cost context
  tokens, and each user-defined MCP server costs tokens too. Plugin on/off state
  lives in ~/.claude/settings.json under "enabledPlugins"; user MCP server
  definitions live in ~/.claude.json under "mcpServers". cpm lets you define
  profiles once — bundling both plugins and MCP servers — and switch between them
  instantly, either by rewriting those files (persistent) or by launching an
  isolated session (one-off). Claude Code has no built-in plugin/MCP presets.

SETUP (first run)
  1. cpm init            Create ~/.claude/cpm.profiles.jsonc (seeded from current plugins)
  2. cpm plugins         List installed plugin ids you can put into profiles
  3. cpm edit            Define your profiles (opens the config in $EDITOR)
  4. cpm use <profile>     Activate one, then restart claude OR run /reload-plugins

PROFILES CONFIG  (~/.claude/cpm.profiles.jsonc — override with --config or $CPM_CONFIG)
  JSONC: comments and trailing commas are allowed. Shape:

    {
      "version": 1,
      "base": {                                  // added to EVERY profile
        "plugins": ["core@acme"],                //   plugins …
        "mcp": ["linear"]                        //   … and MCP servers
      },
      "profiles": {
        "minimal": { "description": "bare", "base": false, "plugins": [] },
        "dev": {
          "extends": "minimal",                  // compose profiles (string or array)
          "plugins": [
            "docker",                             // bare name -> auto-resolved
            "playwright@acme"                     // or full name@marketplace
          ],
          "mcp": ["github", "sentry"]            // user MCP servers, referenced by name
        }
      }
    }

  - A plugin id is name@marketplace. A bare name is resolved against installed
    plugins (hard error if the same name exists in two marketplaces — qualify it).
  - "base.plugins" applies plugins to every profile; "base.mcp" applies MCP servers.
    A profile opts out of BOTH with "base": false.
  - "mcp" lists user MCP servers BY NAME (see MCP MANAGEMENT below).
  - "extends" composes profiles; resolution order is base -> parents -> self, deduped.

APPLYING A PROFILE
  cpm use <profile>           Persistent. Rewrites ~/.claude/settings.json so the
                            profile's plugins are ON and all others OFF. Auto-backed-up;
                            undo with cpm undo. Takes effect on the next claude
                            session or via /reload-plugins.
  cpm run <profile> [-- ...]  One-off. Launches claude with ONLY that profile for a
                            single session; global config untouched. Anything after
                            -- is passed through to claude. "cpm <profile>" (no verb)
                            is shorthand for run. Launches claude through your shell
                            so a claude alias/function (and any env it injects) is
                            honored; set CPM_CLAUDE_BIN to force a direct binary call.

MCP MANAGEMENT
  Profiles can bundle user-defined MCP servers alongside plugins. The server
  *definitions* live in ~/.claude.json under "mcpServers"; profiles reference them
  BY NAME only ("mcp": ["github", ...] and "base.mcp"). To avoid
  losing servers it switches off, cpm keeps a side-store of disabled server
  definitions at ~/.claude/cpm.mcp-store.json and restores them on demand.
    cpm use <profile>   also rewrites ~/.claude.json's "mcpServers" to exactly the
                      profile's set (stashing the rest in the side-store). Undoable
                      with cpm undo, which reverts plugins AND MCP servers together.
    cpm run <profile>   launches an isolated session with ONLY the profile's MCP
                      servers (claude --mcp-config <tmp> --strict-mcp-config);
                      ~/.claude.json is untouched.
  IMPORTANT: MCP servers bundled with plugins are NOT managed by cpm. They stay
  enabled by default and appear as "plugin:..." in \`claude mcp list\`; cpm only
  touches user-defined servers.

ALL COMMANDS
  cpm <profile>         Run claude with just this profile (alias of run)
${commandLines({ flags: true })}
  cpm --version         Print the cpm version

IMPORTANT NOTES
  - Uninstalling is two steps: \`cpm uninstall\` removes cpm's files from ~/.claude
    (profiles config, backups, undo pointer, lock) — it never touches your
    settings.json — then \`npm uninstall -g claude-plugin-manager\` removes the binary.
  - Plugins load at session start. After cpm use, restart claude or run /reload-plugins.
  - cpm manages the USER scope (~/.claude/settings.json). If the current directory
    has its own .claude/settings.json with enabledPlugins, that overrides cpm there —
    use cpm run instead (cpm status warns when this applies).
  - cpm run (and the bare \`cpm <profile>\` shorthand) launches claude with a temporary
    --settings file, which outranks ~/.claude/settings.json. If a profile enables a
    plugin you've globally disabled, Claude Code's plugin view flags it ("Disabled
    in settings.json but still loads — cli flag settings enable it"). This is
    expected: the plugin loads correctly; the note only reports the override. Use
    \`cpm use <profile>\` (persistent) if you want it gone — it enables the plugins in
    settings.json directly, so there's no conflict to report.
  - Environment: CPM_CONFIG (config path), CPM_CLAUDE_JSON (path to ~/.claude.json
    holding mcpServers), CPM_CLAUDE_BIN (direct claude binary, bypassing your
    shell wrapper), NO_COLOR.
  - Exit codes: 0 ok, 2 usage, 3 unknown profile, 4 validation/ambiguity, 5 malformed.
  - Requires Node >=18. cpm run needs the claude CLI on PATH.`);
}

dispatch()
  .then((code) => process.exit(code ?? 0))
  .catch((e) => {
    if (e && e.isCpm) {
      ui.error(e.message);
      process.exit(e.exitCode ?? 1);
    }
    ui.error(e?.stack || String(e));
    process.exit(1);
  });
