# `cpm doctor` — setup diagnostics

Status: 💡 idea

## Problem
Setting cpm up has several quiet failure modes (we hit real ones): `claude` not on
PATH or shadowed by a shell wrapper, a malformed `settings.json`, a config that
doesn't parse, a combo with an ambiguous bare name or a cycle, or a project-level
`.claude/settings.json` that silently overrides `cpm use`. Each currently surfaces
only when you trip over it.

## Idea
A single `cpm doctor` that runs all the checks and prints pass / warn / fail with
concrete remediation — the one command to run (or hand to an agent) when "cpm
isn't doing anything."

## Checks
- Node ≥ 18.
- `claude` resolvable on PATH (report the resolved path; note if a shell function
  shadows it — relevant to `cpm run`). Honour `CPM_CLAUDE_BIN`.
- `~/.claude/settings.json` exists, is valid JSON, has an `enabledPlugins` object.
- Combos config exists and parses (JSONC).
- Every combo resolves: no cycles, no ambiguous bare names, list unknown/uninstalled
  plugins it references.
- `detectProjectOverride(cwd)` → warn if the current dir overrides user scope
  (so `cpm use` won't take effect here; suggest `cpm run`).
- `~/.claude/backups` writable; lock file not stale.
- `claude plugin list --json` works (else cpm is on the file-fallback path).

## Sketch
- New `src/commands/doctor.js`; print a checklist with ✓/⚠/✗ and a fix hint each.
- Mostly orchestration of existing functions — little new logic.
- `--json` for machine/agent consumption.

## Reuses
- `src/settings.js` `readSettings`
- `src/discover.js` `loadConfig`, `getClaudeListJson`, `detectProjectOverride`
- `src/config.js` `resolveProfileEntries`, `src/plugins.js` `resolveEntries`

## Effort
Low–medium (composition of existing pieces).

## Why it's worth it
Directly attacks the "give it to an agent and let it set things up" goal — pairs
naturally with `cpm help`: help explains, doctor verifies.
