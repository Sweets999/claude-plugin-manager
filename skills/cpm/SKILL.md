---
name: cpm
description: >-
  Configure and drive cpm (claude-plugin-manager) — set up plugin/MCP profiles, switch between them, and trim Claude Code context. Use when the user asks to set up cpm, create or edit profiles, pick a leaner plugin set, or cut the context/token bloat that enabled plugins and MCP servers cause.
---

# cpm (claude-plugin-manager)

`cpm` switches between named **profiles** of Claude Code plugins and user MCP servers, so the user can keep their context lean. This skill helps you configure and drive it.

**The authoritative reference is the CLI itself — run `cpm help`.** It prints a complete, self-contained guide: the config schema, every command, and how `use` (persistent) differs from `run` (one-off). Read it before configuring anything; this skill is intentionally short.

## Setting up cpm for a user

1. **See what's installed.** Run `cpm plugins` and `cpm mcp` to list the available plugin ids (`name@marketplace`) and user MCP servers.
2. **Propose a few profiles** based on what they have. Always include a minimal `focus` profile for deep work (few or no plugins). Group related plugins/MCP servers into task-oriented profiles (e.g. `web`, `data`, `review`).
3. **Confirm before writing.** Use AskUserQuestion to check the proposed profiles match what they want.
4. **Write the config.** Run `cpm init` to scaffold `~/.claude/cpm.profiles.jsonc` (seeded from their current set), then edit that file to add the agreed profiles. It's JSONC — comments and trailing commas are allowed.
5. **Don't activate it yourself.** Do **not** run `cpm use`, `cpm run`, or `cpm <profile>` — those change the user's live config/session. Instead, tell the user to run `cpm focus` to start a lean session, or `cpm use <profile>` to persist a profile globally.

## Driving cpm day-to-day

**`cpm <name>` is the main way to use cpm.** A bare profile name (e.g. `cpm focus`, `cpm web`) launches a fresh, isolated `claude` session with only that profile loaded, and never touches the user's global config. It's shorthand for `cpm run <name>`. Recommend this first; reach for `cpm use` only when the user explicitly wants a *persistent* global default.

Common commands:

- `cpm <name>` — start an isolated session with just that profile (the default, recommended path). No restart needed; the new session is already configured.
- `cpm use <name>` — persist a profile as the global default. Reversible with `cpm undo`. Because plugins load at session start, it takes effect in the *next* session or after `/reload-plugins`.
- `cpm undo` — revert the last `cpm use` (plugins and MCP servers together).
- `cpm ls` — list the defined profiles.
- `cpm status` — show the currently enabled set, the matching profile (if any), and warnings.
- `cpm diff <name>` — preview exactly what `cpm use <name>` would change, before running it.
- `cpm plugins` / `cpm mcp` — list installed plugins and MCP servers with their enabled state.

## Guardrails

- **Don't activate profiles on the user's behalf during setup.** After writing config, tell the user which command to run (`cpm <name>`) rather than running it yourself — `cpm use`/`cpm run`/`cpm <name>` change the live config or session.
- **Prefer `cpm <name>` over `cpm use`** unless the user asks for a persistent default — it's reversible by simply closing the session and leaves global config untouched.
- **`cpm help` is the source of truth.** If anything here seems out of date or you need a flag, exit code, or the config schema, read `cpm help` rather than guessing.

See `cpm help` for the full command list, flags, and config reference.
