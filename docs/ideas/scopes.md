# Project / local scope (`--scope`)

Status: ⏸ deferred (intentionally out of MVP — cpm owns the user scope only)

## Problem
cpm currently edits only the **user** layer (`~/.claude/settings.json`). But
`enabledPlugins` overrides (doesn't merge) down the hierarchy:

    managed > --settings flag > project .claude/settings.json
            > project .claude/settings.local.json > user ~/.claude/settings.json

So inside a repo that pins its own `enabledPlugins`, `cpm use` has no effect there
(we surface this today as a warning in `cpm status` via `detectProjectOverride`).

## Idea
`cpm use <combo> --scope project|local|user` (default `user`), writing:
- `user` → `~/.claude/settings.json` (current behaviour)
- `project` → `<cwd>/.claude/settings.json`
- `local` → `<cwd>/.claude/settings.local.json` (gitignored)

Lets a repo declare "in here, use this combo" — and because project/local outrank
user, it actually takes effect in that repo without a session relaunch wrapper.

## Sketch
- Resolve the target settings path from `--scope` + `cwd` in `src/paths.js` /
  command layer; pass it to `writeEnabledPlugins` (which already takes a path).
- Backups/undo pointer should be scoped per target (e.g. keyed by path) so
  `cpm undo` reverts the right file.
- `cpm status` should show *which* scope is currently winning in this directory.

## Reuses
- `src/settings.js` `writeEnabledPlugins`/`restore` already path-parameterised.
- `src/discover.js` `detectProjectOverride` already finds the project files.

## Effort
Medium — mainly undo/backup bookkeeping across multiple scopes, and clear status
reporting of precedence.

## Open questions
- Should the exclusive "everything else off" universe differ per scope? For a
  project scope you may want a *smaller* declared set rather than disabling the
  whole universe. Decide semantics before building.
- Interaction with `cpm run` (which uses `--settings`, outranking project) — keep
  both; document when to use which.
