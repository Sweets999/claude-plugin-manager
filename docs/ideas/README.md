# cpm — ideas & backlog

Parking lot for features and improvements that came up while designing/building
cpm but were deliberately left out of the first cut. Nothing here is committed
work — it's a backlog so the thinking isn't lost.

Each note records: the problem, a concrete sketch, which existing code it would
reuse (so a future contributor/agent can pick it up), rough effort, and open
questions.

## Status legend
- 💡 idea — not started
- 🧪 partial — a hook/stub already exists in the code
- ⏸ deferred — intentionally out of MVP scope

## Bigger ideas (own notes)
| Idea | Status | Note |
|---|---|---|
| Context/token cost budgeting (`--cost`) | 💡 | [context-cost-budgeting.md](context-cost-budgeting.md) — the headline "context budgeter" feature; flag removed from the CLI for 0.x, design retained |
| `cpm doctor` setup diagnostics | 💡 | [cpm-doctor.md](cpm-doctor.md) — self-check that explains setup problems (we hit several) |
| Project / local scope (`--scope`) | ⏸ | [scopes.md](scopes.md) — write `.claude/settings.json` for a repo, not just user |
| Ergonomics (completion, which, closest-match, ad-hoc) | 💡 | [ergonomics.md](ergonomics.md) — a cluster of small UX wins |

## Smaller items / backlog
| Item | Status | Sketch |
|---|---|---|
| `cpm help <command>` per-command help | 💡 | Detailed help for a single subcommand; `bin/cpm.js` already centralises help text |
| `cpm backups` list/prune | 💡 | `~/.claude/backups/settings.json.cpm.*.bak` accumulate forever; add list + `--prune --keep N` |
| Combo groups / whole-marketplace combos | 💡 | A combo that enables every plugin from a marketplace (glob `*@market`) |
| `cpm init --interactive` | 💡 | Guided combo creation instead of editing JSONC by hand |
| Config-level defaults | 💡 | e.g. `"strict": true` or `"budget": 50000` at top level of the config |
| Stable `--json` schema doc | 💡 | Document the shapes emitted by `ls/status/plugins/diff --json` for scripting |

## Testing / engineering debt
- **Windows**: `fs.renameSync`-over-target isn't atomic on Windows; current code
  targets macOS/Linux. Note in README or guard if Windows support is wanted.
- **`claude plugin list --json` shape** is assumed (array of `{id,enabled,scope}`),
  parsed in `src/discover.js`/`src/plugins.js`. Re-verify against new Claude Code
  releases; settings precedence can also shift between versions.

## Distribution / release
- **Tag `v0.1.0` + GitHub Release** so users can pin: `npm i -g github:Sweets999/claude-plugin-manager#v0.1.0`.
- **Publish to npm** (`npm install -g claude-plugin-manager`) once an npm account is
  available — the name is currently free. Add `"prepublishOnly": "npm test"`.
- **CHANGELOG.md** added (`0.2.0`); keep up semver discipline as external users arrive.
