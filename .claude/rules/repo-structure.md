---
paths:
  - "src/**/*.js"
  - "bin/**/*.js"
---

# Repository structure & architecture (enforced)

This codebase is split into a **pure core** (no IO, fully unit-tested) and a **thin
IO/command shell**. The authoritative module map is `AGENTS.md` — read it before
adding code. The rules below are non-negotiable.

## Layering — keep decisions in the pure layer

- **Pure core (no IO):** `src/config.js`, `src/plugins.js`, `src/mcp.js`,
  `src/planner.js`, `src/jsonc.js`. These MUST NOT read/write files, spawn
  processes, read `process.env`, or print. New decision logic belongs here so it
  can be unit-tested directly.
- **IO layer:** `src/settings.js`, `src/discover.js`, `src/runner.js`,
  `src/paths.js`. All filesystem/process access lives here and nowhere else.
- **Commands (`src/commands/*.js`):** keep them DUMB. A command default-exports
  `async (ctx) => exitCode` and only: parses args, calls core/discover, and renders
  via `ctx.ui`. Do NOT put business logic, raw `console.log`, or direct file IO in
  a command.

## Adding or renaming a command = one registry entry + one file

- Declare the command ONCE in `COMMANDS` in `src/commands.js` (the single source of
  truth) and create the matching `src/commands/<name>.js`. `bin/cpm.js`,
  `src/cli.js`, and both help texts derive from the registry automatically.
- Never hardcode a command name or alias in `bin/cpm.js` or `src/cli.js` — add it to
  the registry. `test/commands.test.js` guards against drift; keep it green.

## Paths & environment

- Every filesystem path comes from `src/paths.js`. Do NOT hardcode `~/.claude`,
  `~/.claude.json`, or any path elsewhere. All paths are overridable via the
  `CPM_*` env vars (`CPM_HOME`, `CPM_CONFIG`, `CPM_CLAUDE_BIN`, `CPM_CLAUDE_JSON`)
  so tests can redirect IO — preserve that.

## Errors & exit codes

- Errors are typed and carry exit codes (`src/errors.js`). Throw the right
  `CpmError` subclass; NEVER call `process.exit` from core or commands —
  `bin/cpm.js` catches typed errors and exits. Codes: `0` ok · `2` usage ·
  `3` unknown profile · `4` validation/ambiguity · `5` malformed config/settings.

## Module hygiene

- ES modules only (`"type": "module"`), Node ≥ 18. Imports MUST include the `.js`
  extension (e.g. `import { x } from './config.js'`).
- **Stay dependency-light.** Runtime has exactly one dependency (`jsonc-parser`).
  Do NOT add a runtime or dev dependency without a strong, stated reason.

## Invariant: `use` is persistent & reversible; `run` never touches global config

Anything that mutates global state MUST back up prior content and write an undo
pointer. Multi-file mutations (plugins + MCP) go through `applyProfile` (one
combined v2 pointer). `run` writes only temp files and MUST NOT mutate global config.
