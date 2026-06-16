# cpm — claude-plugin-manager

Switch between named **profiles** of Claude Code plugins and MCP servers in one
keystroke, to keep your context lean.

Every enabled plugin loads its MCP servers, skills, commands and hooks into the
session — and each user-defined MCP server you enable — all of which cost context
tokens. As you accumulate plugins and MCP servers, the baseline cost grows even
when most are irrelevant to the task. Claude Code has no built-in concept of
plugin or MCP presets; the only knobs are the `enabledPlugins` map in
`~/.claude/settings.json` and the `mcpServers` map in `~/.claude.json`, toggled
one at a time.

`cpm` lets you declare profiles bundling both plugins and MCP servers once, and
switch instantly:

```console
$ cpm focus          # launch a lean session with just this profile loaded
$ cpm use focus      # or make it your persistent global default
$ cpm undo           # revert the last persistent swap
```

## Quick start

Paste this into your Claude CLI and it'll install and configure everything for you:

```text
Install claude-plugin-manager globally with `npm install -g @sweets999/claude-plugin-manager`,
then run `cpm help` and `cpm plugins` to learn the tool and see what I have installed.
Based on my installed plugins, propose a few sensible profiles — including a minimal
"focus" profile for deep work — then use AskUserQuestion to check I'm happy with the
suggested setup before writing anything. Once I confirm, write the config. Don't run
any `cpm use`/`cpm focus`/`cpm run` commands yourself — just tell me at the end to run
`cpm focus` to start a lean session with only that profile.
```

After that, `cpm focus` is all you need day-to-day — a bare profile name launches an
isolated `claude` session with just that profile loaded (shorthand for `cpm run focus`,
and the most succinct way to use `cpm`). Read on for manual setup and the full
command list.

## Install

Requires Node ≥ 18.

```bash
npm install -g @sweets999/claude-plugin-manager
```

That puts `cpm` on your PATH. Run it once without installing:

```bash
npx @sweets999/claude-plugin-manager help
```

Prefer installing straight from GitHub? `npm install -g github:Sweets999/claude-plugin-manager` works too.

`cpm run` also needs the `claude` CLI on your PATH.

### Handing this to an AI agent

Give your agent the package and tell it to run **`cpm help`** — that prints a
complete, self-contained setup + usage guide (config format, every command, how
profiles work), so the agent can get you configured without any other docs.

### From source (development)

```bash
git clone https://github.com/Sweets999/claude-plugin-manager && cd claude-plugin-manager
npm install && npm link
```

## Uninstall

Removing `cpm` cleanly is two steps, because npm only manages the package itself —
it can't reach the files `cpm` writes into `~/.claude/`. So first let `cpm` clean up
after itself, then remove the binary:

```bash
cpm uninstall                      # remove cpm's files from ~/.claude (asks first)
npm uninstall -g @sweets999/claude-plugin-manager   # then remove the cpm binary
```

`cpm uninstall` removes everything `cpm` created — your profiles config
(`cpm.profiles.jsonc`), the MCP side-store (`cpm.mcp-store.json`), the `backups/`
snapshots, the undo pointer, and the lock file. It **never touches `settings.json`
or `.claude.json`** (run `cpm undo` first if you want to revert plugin/MCP changes).
If the MCP store contains disabled servers not in `.claude.json`, `cpm uninstall`
offers to restore them first. Because the profiles config is your own authored data,
it asks before deleting it.

```bash
cpm uninstall --dry-run     # show exactly what would be removed, change nothing
cpm uninstall --keep-config # remove everything except your profiles config
cpm uninstall --purge -y    # remove everything, no prompts
```

> Installed from source with `npm link`? Use `npm rm -g @sweets999/claude-plugin-manager`
> (or `npm unlink`) for the last step instead.

## Manual setup

```bash
cpm init           # writes ~/.claude/cpm.profiles.jsonc, seeded with your current set
cpm edit           # define your profiles
cpm ls             # list profiles
cpm focus          # launch a lean session with just this profile (no restart needed)
cpm use focus      # …or persist it globally (takes effect next session / /reload-plugins)
```

Because plugins load at session start, after `cpm use` you either start a new
`claude` session or run `/reload-plugins` inside a running one. `cpm run` sidesteps
this — it launches a fresh session already configured.

## Two ways to apply a profile

| Command | Effect |
|---|---|
| `cpm use <profile>` | Rewrites `~/.claude/settings.json` (plugins) and `~/.claude.json` (MCP servers) (**persistent**, global). Exclusive: the profile's plugins/MCP servers on, all others off. Backed up; reversible with `cpm undo`. |
| `cpm run <profile> [-- <claude args>]` | Launches `claude --settings <temp> --mcp-config <temp>` with **only** this profile for one session. Global config is never touched. `cpm <profile>` (no verb) is shorthand for this. |

`run` even wins inside a repo that pins its own `enabledPlugins` (a `--settings`
file outranks project settings); `use` does not — `cpm status` warns you when
you're in such a directory.

> Because that `--settings` file outranks your global settings, Claude Code's
> plugin view may flag any profile plugin you've globally disabled as *"Disabled in
> settings.json but still loads — cli flag settings enable it."* That's expected —
> the plugin loads correctly and the note only reports the override. Prefer
> `cpm use <profile>` if you want it gone: it enables the plugins in `settings.json`
> directly, so there's no conflict to report.

## Commands

```
cpm <profile>              Run claude with just this profile (alias of `run`)
cpm use <profile>          Persistent global swap        [-n/--dry-run] [-y/--yes] [--strict]
cpm run <profile> [-- …]   One-off isolated session      [--strict]
cpm ls                   List profiles                   [--json]
cpm status               Current enabled set + matching profile + warnings   [--json]
cpm plugins              Installed plugins + enabled state                  [--json]
cpm mcp                  MCP servers (user: enabled/disabled; plugin: always on)  [--json]
cpm diff <profile>         Preview what `use` would change (plugins + MCP)    [--json]
cpm save <name>          Save the current enabled set as a profile            [--force]
cpm edit                 Open the profiles config in $EDITOR
cpm undo                 Revert the last `use` (plugins + MCP together)
cpm init                 Create a starter profiles config                     [--force]
cpm uninstall            Remove all cpm files     [-n/--dry-run] [-y/--yes] [--purge] [--keep-config]
cpm help                 Full setup + usage guide (ideal to hand to an AI agent)
```

Exit codes: `0` ok · `2` usage · `3` unknown profile · `4` validation/ambiguity ·
`5` malformed config/settings.

## The profiles config

`~/.claude/cpm.profiles.jsonc` (override with `--config` or `$CPM_CONFIG`). It's
**JSONC** — comments and trailing commas are allowed, and `cpm save` preserves
your comments and ordering.

```jsonc
{
  "version": 1,

  // Added to EVERY profile (a profile opts out of BOTH lists with "base": false).
  "base": {
    "plugins": ["core@acme"],   // plugins added to every profile
    "mcp": ["linear"]           // user MCP servers added to every profile
  },

  "profiles": {
    "minimal": {
      "description": "Bare context",
      "base": false,        // opts out of BOTH base.plugins + base.mcp
      "plugins": []
    },

    "web": {
      "description": "Web dev",
      "extends": "minimal",                 // string or array; composes profiles
      "plugins": [
        "docker",                            // bare name → resolved to its marketplace
        "playwright@acme"                    // fully-qualified → used as-is
      ],
      "mcp": ["github", "sentry"]           // user MCP servers, by name
    }
  }
}
```

- **Plugin ids** are `name@marketplace`. A **bare name** is resolved against your
  installed plugins; if it's installed in two marketplaces, `cpm` errors and asks
  you to fully-qualify it.
- **MCP servers** are referenced by their name key in `~/.claude.json`. Plugin-bundled
  MCPs (appear as `plugin:...` in `claude mcp list`) are NOT managed by cpm.
- **`base`** is a nested object: **`base.plugins`** applies plugins to every profile
  and **`base.mcp`** applies MCP servers. A profile with `"base": false` opts out of
  BOTH.
- **`extends`** composes profiles. Resolution order is `base → parents → self`,
  deduped; cycles are detected.
- A profile referencing an uninstalled plugin or unknown MCP server produces a warning
  (or an error under `--strict`).

## How it works / safety

- `cpm use` changes only the `enabledPlugins` key in `~/.claude/settings.json` and
  the `mcpServers` key in `~/.claude.json`. All other settings, their order, and
  indentation are preserved. Writes are atomic (temp file + rename) and prior
  content is copied to `~/.claude/backups/`.
- User MCP servers disabled by a profile are stashed in `~/.claude/cpm.mcp-store.json`
  (a superset of definitions) so they can be re-enabled later. Plugin-bundled MCP
  servers are never touched.
- `cpm undo` restores the previous state from a combined pointer at
  `~/.claude/cpm.last.json` — reverting both plugins and MCP servers together in
  one operation.
- Plugin discovery uses `claude plugin list --json` when available, falling back
  to `~/.claude/plugins/installed_plugins.json`.
- Malformed JSON in `settings.json` or `.claude.json` is never overwritten — `cpm`
  refuses and points you at your backups.

## Environment

- `CPM_CONFIG` — path to the profiles config.
- `CPM_CLAUDE_JSON` — path to `~/.claude.json` (the file holding `mcpServers`).
  Defaults to `~/.claude.json`.
- `CPM_CLAUDE_BIN` — path to the `claude` binary. Forces a **direct** call,
  bypassing your shell wrapper. By default `cpm run` launches `claude` through your
  shell (`$SHELL -i -c`) so a `claude` alias/function — and any env it injects —
  is honored, just as if you'd typed `claude` yourself. This applies on Linux and
  macOS with a POSIX-family shell (`bash`, `zsh`, `ksh`, `dash`, …); with `fish`,
  `csh`/`tcsh`, no `$SHELL`, or no TTY, `cpm` makes a direct call instead (set
  `CPM_CLAUDE_BIN`, or define `claude` as a real binary on `PATH`, if you need a
  wrapper's env in those shells).
- `NO_COLOR` — disable colour.

## Development

```bash
npm test          # node --test
```

Core logic (`config`, `plugins`, `planner`, `settings`) is pure and unit-tested;
the command layer is a thin shell over it.

Future ideas and the backlog live in [`docs/ideas/`](docs/ideas/).
