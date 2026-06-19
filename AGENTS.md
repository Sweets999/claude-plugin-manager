# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`cpm` (claude-plugin-manager) is a zero-dependency-at-runtime CLI (one dep: `jsonc-parser`) that switches between named **profiles** of Claude Code plugins and user-defined MCP servers. Plugin on/off state lives in `~/.claude/settings.json` under `enabledPlugins`; user MCP server definitions live in `~/.claude.json` under `mcpServers`. `cpm` rewrites those maps (or launches an isolated session) so users can keep their context lean. There is no build step — it's plain ES modules run directly by Node ≥ 18.

## Commands

```bash
npm test                         # run all tests (node --test)
node --test test/planner.test.js # run one test file
node --test --test-name-pattern="computeExclusiveSet"  # run tests matching a name
node bin/cpm.js <args>           # run the CLI locally without installing
npm link                         # put `cpm` on PATH for manual testing
```

There is no linter or build configured. `npm test` is the only check.

## Architecture

The codebase is deliberately split into a **pure core** (no IO, fully unit-tested) and a **thin IO/command shell** around it. When adding logic, keep decisions in the pure layer and keep `commands/` dumb.

**Entry + dispatch**
- `src/commands.js` — the **command registry** (`COMMANDS`, `KNOWN_COMMANDS`, `ALIAS_TO_NAME`). Single source of truth: commands are declared once here, and `cli.js` + `bin/cpm.js` derive from it. **To add or rename a command, edit this registry and add/rename the matching `src/commands/<name>.js` file** — both help texts and the parser update automatically (`test/commands.test.js` guards against drift).
- `bin/cpm.js` — executable. Parses argv, builds a `ctx`, resolves aliases via `ALIAS_TO_NAME`, dynamically imports `src/commands/<name>.js`, and renders the two help texts (`printHelp` concise, `printGuide` the full `cpm help` agent-facing guide) by iterating `COMMANDS`.
- `src/cli.js` — `parseArgs`. Pure. Imports `KNOWN_COMMANDS` from the registry, maps short flags, captures everything after `--` as `passthrough`, and routes a bare first arg (not a known verb) to `run`. Bare `cpm` → `status`.

**Pure core (no IO — unit-test these directly)**
- `src/config.js` — parse/validate the JSONC profiles config. `base` is a nested object `{ plugins, mcp }`; `resolveProfileEntries` composes `base.plugins → parents (extends) → self`, deduped, with cycle detection, returning *raw* plugin entries (still possibly bare names). `resolveMcpEntries` does the same over `base.mcp` and each profile's `mcp` array. A profile's `"base": false` opts out of BOTH `base.plugins` and `base.mcp`. `normalizeConfig` hard-errors (exit 5) on the legacy top-level array `base` / `mcpBase` shape with migration guidance — no silent auto-migration. Profile keys: `plugins?: string[]`, `mcp?: string[]`, `extraArgs?: string[]`, `extends?: string | string[]`, `base?: false`, `description?: string`.
- `src/plugins.js` — `getUniverse` (the set of known plugin ids) and `resolveEntries` (bare `name` → `name@marketplace`, e.g. `docker` → `docker@acme`; 0 matches dropped+reported, 1 resolved, >1 is a hard error even without `--strict`).
- `src/mcp.js` — MCP analogue of `plugins.js`. `getMcpUniverse` (set of known user MCP server names from the store + live), `mergeStore` (live defs override store defs), `resolveMcpNames` (validate profile MCP entries against universe; no ambiguity — names are unique).
- `src/planner.js` — `computeExclusiveSet` (profile's plugins on, every other known plugin explicitly off) and `diff`. New: `computeMcpDesired` (profile's MCP servers; just a pick from the merged definitions, no "off" state) and `diffMcp`.
- `src/jsonc.js` — JSONC parsing wrapper over `jsonc-parser`.

**IO layer**
- `src/settings.js` — read/write `~/.claude/settings.json` and `~/.claude.json`. `writeJsonKey` is a low-level primitive (mutate one top-level key in any JSON file, preserve order/indent, optional backup). `writeEnabledPlugins` is the legacy single-file wrapper (still used for plugin-only operations; writes a v1 undo pointer). New: `readMcpServers`/`readMcpStore`/`writeMcpStore` for the MCP side-store (`~/.claude/cps.mcp-store.json`); `applyProfile` is the multi-file orchestrator — takes multiple `{ filePath, key, value }` specs, writes them under one lock, and emits one combined v2 undo pointer. `restore` (undo) handles both pointer shapes (v2 multi-file, v1 legacy plugin-only). **Refuses to overwrite malformed JSON** rather than clobbering.
- `src/discover.js` — the glue: loads config + plugin state (`claude plugin list --json` with fallback to `installed_plugins.json`), and `planProfile` ties config → universe → desired map → diff. New: `loadMcpState` (live + store + merged universe), `planMcpProfile` (MCP analogue of `planProfile`), `planFull` (combined plan for both axes), `getMcpListText`/`parsePluginMcpNames` (cosmetic discovery of plugin-bundled MCP servers for `cps mcp`). Most commands call `loadConfig` + `planProfile` or `planFull`.
- `src/runner.js` — `cpm run`: writes temp settings file with only `enabledPlugins` and temp MCP config (when `mcpServers` provided) and spawns `claude --settings <tmp> --mcp-config <tmp> --strict-mcp-config`. A `--settings` file overrides project settings; `--strict-mcp-config` makes the temp MCP config exclusive (which is why `run` works where `use` doesn't for project overrides).
- `src/paths.js` — single source of truth for every filesystem path; all overridable via env (`CPM_HOME`, `CPM_CONFIG`, `CPM_CLAUDE_BIN`, `CPM_CLAUDE_JSON`) so tests redirect IO to a tmp dir. New paths: `claudeJson` (`~/.claude.json`), `mcpStore` (`~/.claude/cpm.mcp-store.json`).

**Commands** (`src/commands/*.js`) — each default-exports `async (ctx) => exitCode`. `ctx` carries `{ paths, flags, args, passthrough, env, cwd, ui }`. Keep them thin: parse args, call core/discover, render via `ctx.ui`.

**Presentation**
- `src/ui.js` — the `ui` object (`print`/`info`/`warn`/`error`/`success`, color helpers, JSON mode). All output goes through here; respects `--json`, `--quiet`, `NO_COLOR`.
- `src/render.js` — formats plans/diffs into human strings.
- `src/prompt.js` — interactive confirmation for `use`.

## Conventions

- **Errors are typed and carry exit codes** (`src/errors.js`): `0` ok · `2` usage · `3` unknown profile · `4` validation/ambiguity · `5` malformed config/settings. Throw the right `CpmError` subclass rather than calling `process.exit`; `bin/cpm.js` catches `isCpm` errors and exits with `exitCode`. No new exit codes for MCP (unknown MCP names use the existing StrictValidationError / exit 4).
- **`use` is persistent and reversible; `run` never touches global config.** Preserve this invariant — anything that mutates global state must back up and write an undo pointer. Multi-file mutations (plugins + MCP) must go through `applyProfile` (which writes one combined v2 pointer). Plugin-only legacy callers can still use `writeEnabledPlugins` (v1 pointer).
- Plugin ids are `name@marketplace`. Bare names are a config convenience resolved against the installed universe; ambiguity is always a hard error. MCP server names are bare (no marketplace concept; unique within `~/.claude.json`), so no ambiguity.
- ES modules only (`"type": "module"`), Node ≥ 18, `.js` extensions required in imports.

## Docs

`docs/ideas/` holds the backlog and deferred designs (e.g. `--cost` budgeting, scopes, `cps doctor`). The `--cost` flag was removed from the CLI for the 0.x release; only its design note remains. Check the relevant command file before assuming a flag is wired up.

User-visible changes are tracked in `CHANGELOG.md`; contributor setup/conventions live in `CONTRIBUTING.md`.
