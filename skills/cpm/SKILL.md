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

- `cpm focus` (or any bare profile name) — launch an isolated `claude` session with just that profile loaded. Shorthand for `cpm run focus`.
- `cpm use <profile>` — persist a profile as the global default. Reversible with `cpm undo`; takes effect next session or via `/reload-plugins`.
- `cpm ls` / `cpm status` / `cpm diff <profile>` — list profiles, show the current set, and preview what a swap would change.

See `cpm help` for everything else.
