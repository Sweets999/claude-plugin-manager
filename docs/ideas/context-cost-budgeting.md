# Context / token cost budgeting (`--cost`)

Status: 💡 idea — the `--cost` flag was removed from the CLI for the 0.x release
(it only ever printed "not implemented yet"). This note records the intended
design so the feature can be picked up later.

## Problem
The whole reason cpm exists is context bloat — but today it shows *which* plugins
are on, not *how much context they cost*. Users pick combos blind to the actual
token savings.

## Idea
Surface projected token cost per plugin and per combo, turning cpm from a
"switcher" into a **context budgeter**.

- `cpm plugins --cost` → token cost column per plugin.
- `cpm ls --cost` → projected total tokens per combo.
- `cpm diff <combo> --cost` → "this swap saves ~N tokens".
- Optional config budget: `"budget": 50000` at top level → warn (or fail under
  `--strict`) when a combo's projected cost exceeds it.

## Data source
`claude plugin details <plugin>` reports a projected token cost / component
inventory. That's the input. Investigate whether it supports `--json` (preferred);
otherwise parse the human output carefully.

## Sketch
- Add `getPluginCost(ctx, id)` to `src/discover.js`: shell `claude plugin details`,
  parse the token number, **cache** results (per-process map; details calls are
  slow — one subprocess per plugin).
- Thread an optional `cost` into the rows built by `src/commands/plugins.js`,
  `ls.js`, `diff.js`. Sum for combo totals.
- Only fetch costs when `--cost` is passed (it's expensive); otherwise skip.

## Reuses
- `src/commands/plugins.js`, `ls.js`, `diff.js` build the rows that would carry a
  `cost` field — thread it through there and sum for profile totals.
- The row-rendering in `src/render.js` (`renderPluginList`) is the natural place to
  re-add a cost column.

## Effort
Medium — mostly the fragile parsing of `claude plugin details` output + caching.

## Open questions
- Exact `claude plugin details` output format / `--json` availability (verify).
- Are costs additive across plugins, or is there shared/base overhead that makes
  naive summing misleading? Caveat the numbers as estimates.
