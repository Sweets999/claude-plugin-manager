<div align="center">
  <img width="600" alt="Screenshot 2026-06-16 at 20 01 54" src="https://github.com/user-attachments/assets/a22db77e-7b87-42ec-a742-6d0dc96e0241" />
  
  <h1 align="center">CPM</h1>

  [![npm version](https://img.shields.io/npm/v/@sweets999/claude-plugin-manager.svg)](https://www.npmjs.com/package/@sweets999/claude-plugin-manager)
  [![CI](https://github.com/Sweets999/claude-plugin-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/Sweets999/claude-plugin-manager/actions/workflows/ci.yml)
  [![node](https://img.shields.io/node/v/@sweets999/claude-plugin-manager.svg)](https://nodejs.org)
  [![license: MIT](https://img.shields.io/npm/l/@sweets999/claude-plugin-manager.svg)](LICENSE)
  [![maintainer: Sweets999](https://img.shields.io/badge/maintainer-Sweets999-blue.svg)](https://github.com/Sweets999)
</div>

Switch between named **profiles** of Claude Code plugins and MCP servers in one
keystroke, to keep your context lean.

Every enabled plugin loads its MCP servers, skills, commands and hooks into the
session — and each user-defined MCP server you enable too — all of which cost
context tokens. As you accumulate them, the baseline cost grows even when most are
irrelevant to the task. Claude Code has no built-in concept of plugin or MCP
presets; the only knobs are the `enabledPlugins` map in `~/.claude/settings.json`
and the `mcpServers` map in `~/.claude.json`, toggled one at a time.

`cpm` lets you declare profiles bundling both plugins and MCP servers once, and
switch instantly:

```console
$ cpm focus          # launch a lean session with just this profile loaded
$ cpm use focus      # or make it your persistent global default
$ cpm undo           # revert the last persistent swap
```

<!-- VHS: drop a recorded demo here, e.g. ![cpm demo](docs/demo.gif) -->

## Contents

- [Quick start](#quick-start)
- [Install](#install)
- [How Claude configures it](#how-claude-configures-it)
- [Manual setup](#manual-setup)
- [Two ways to apply a profile](#two-ways-to-apply-a-profile)
- [Example profiles](#example-profiles)
- [Commands](#commands)
- [The profiles config](#the-profiles-config)
- [How it works and safety](#how-it-works-and-safety)
- [Environment](#environment)
- [FAQ and troubleshooting](#faq-and-troubleshooting)
- [Uninstall](#uninstall)
- [Development](#development)

## Quick start

Install it, then let Claude set it up for you:

```bash
npm install -g @sweets999/claude-plugin-manager
```

A global install also drops a small **Claude skill** into `~/.claude/skills/` (see
[How Claude configures it](#how-claude-configures-it)). So now you can just tell
Claude:

> **set up cpm**

and it will inspect your installed plugins, propose a few sensible profiles
(including a minimal `focus` profile for deep work), confirm with you, and write
the config — no manual steps.

After that, **`cpm focus`** is all you need day-to-day: a bare profile name
launches an isolated `claude` session with just that profile loaded (shorthand for
`cpm run focus`, and the most succinct way to use `cpm`).

<details>
<summary>No skill? Paste this prompt into Claude instead</summary>

```text
Install claude-plugin-manager globally with `npm install -g @sweets999/claude-plugin-manager`,
then run `cpm help` and `cpm plugins` to learn the tool and see what I have installed.
Based on my installed plugins, propose a few sensible profiles — including a minimal
"focus" profile for deep work — then use AskUserQuestion to check I'm happy with the
suggested setup before writing anything. Once I confirm, write the config. Don't run
any `cpm use`/`cpm focus`/`cpm run` commands yourself — just tell me at the end to run
`cpm focus` to start a lean session with only that profile.
```

</details>

## Install

Requires **Node ≥ 18**.

```bash
npm install -g @sweets999/claude-plugin-manager
```

That puts `cpm` on your PATH. Run it once without installing:

```bash
npx @sweets999/claude-plugin-manager help
```

Prefer installing straight from GitHub? `npm install -g github:Sweets999/claude-plugin-manager` works too.

`cpm run` also needs the `claude` CLI on your PATH.

### The bundled skill

A **global** install runs a postinstall step that copies this repo's
[`skills/cpm/SKILL.md`](skills/cpm/SKILL.md) to `~/.claude/skills/cpm/SKILL.md`.
It's tiny and defers to `cpm help`, so Claude always reads the authoritative
guide. Manage it directly if you need to:

```bash
cpm skill install     # (re)install it — handy after a sandboxed/CI install
cpm skill uninstall   # remove just the skill
cpm skill path        # print where it lives
```

To skip the automatic install, set `CPM_NO_POSTINSTALL=1` before installing. The
skill is also removed by `cpm uninstall`.

## How Claude configures it

There are two complementary ways Claude learns to drive `cpm`:

- **The bundled skill** ([`skills/cpm/SKILL.md`](skills/cpm/SKILL.md)) — installed
  automatically (above). Once it's there, "set up cpm" is enough; the skill walks
  Claude through inspecting your plugins, proposing profiles, confirming with you,
  and writing the config.
- **`cpm help`** — a complete, self-contained guide (config format, every command,
  how profiles work) that prints to the terminal. Hand it to any agent and it can
  get you configured with no other docs. The skill points back to it as the source
  of truth, so there's nothing to keep in sync.

## Manual setup

Prefer to do it yourself?

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

## Example profiles

A few realistic profiles to copy into your config (see
[The profiles config](#the-profiles-config) for the full schema):

```jsonc
{
  "version": 1,

  // Always on, in every profile.
  "base": { "plugins": ["core@acme"], "mcp": [] },

  "profiles": {
    // Deep work: nothing extra loaded. The leanest possible context.
    "focus": { "description": "Deep work", "base": false, "plugins": [] },

    // Web app development.
    "web": {
      "description": "Web dev",
      "plugins": ["docker", "playwright@acme"],
      "mcp": ["github", "sentry"]
    },

    // Data / notebooks.
    "data": {
      "description": "Data & notebooks",
      "plugins": ["jupyter@acme"],
      "mcp": ["postgres"]
    },

    // Code review: builds on web, adds a reviewer plugin.
    "review": {
      "description": "PR review",
      "extends": "web",
      "plugins": ["code-review@acme"]
    }
  }
}
```

Then: `cpm focus` for a clean session, `cpm web` to spin up the web stack, or
`cpm use review` to make review your persistent default.

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
cpm skill <sub>          Install/remove the bundled Claude skill  (install | uninstall | path)
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

## How it works and safety

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
- `CPM_NO_POSTINSTALL` — set to skip auto-installing the bundled skill on
  `npm install -g`.
- `NO_COLOR` — disable colour.

## FAQ and troubleshooting

**My `cpm use` / `cpm focus` didn't change anything in my running session.**
Plugins load at session start. Restart `claude`, or run `/reload-plugins` inside
the current session. `cpm run` (and `cpm <profile>`) avoid this by launching a
fresh, already-configured session.

**A bare plugin name errors with "ambiguous" / "not found".**
Bare names are resolved against your installed plugins. If the same name exists in
two marketplaces, fully-qualify it as `name@marketplace`. If it isn't installed at
all, you get a warning (or an error under `--strict`). Run `cpm plugins` to see the
exact ids.

**I'm in a repo and `cpm use` doesn't take effect.**
That repo probably pins its own `enabledPlugins` in a project `.claude/settings.json`,
which overrides the user scope `cpm` manages. Use `cpm run <profile>` there — a
`--settings` file outranks project settings. `cpm status` warns when you're in such
a directory.

**Claude Code says a plugin is "Disabled in settings.json but still loads".**
Expected when using `cpm run` / `cpm <profile>`: the temporary `--settings` file
enables the profile's plugins on top of your global settings, and Claude Code just
reports the override. The plugin loads correctly. Use `cpm use <profile>` if you
want the note gone.

**Does `cpm` touch MCP servers that come bundled with a plugin?**
No. `cpm` only manages user-defined servers in `~/.claude.json`. Plugin-bundled
servers (shown as `plugin:...` in `claude mcp list`) stay enabled with their plugin.

**How do I undo or recover?**
`cpm undo` reverts the last `cpm use` (plugins and MCP together). Every write is
also backed up under `~/.claude/backups/`.

**How do I remove the bundled skill?**
`cpm skill uninstall` removes just the skill; `cpm uninstall` removes it along with
everything else `cpm` created. Set `CPM_NO_POSTINSTALL=1` to never install it.

## Uninstall

Removing `cpm` cleanly is two steps, because npm only manages the package itself —
it can't reach the files `cpm` writes into `~/.claude/`. So first let `cpm` clean up
after itself, then remove the binary:

```bash
cpm uninstall                      # remove cpm's files from ~/.claude (asks first)
npm uninstall -g @sweets999/claude-plugin-manager   # then remove the cpm binary
```

`cpm uninstall` removes everything `cpm` created — your profiles config
(`cpm.profiles.jsonc`), the MCP side-store (`cpm.mcp-store.json`), the bundled skill
(`skills/cpm/SKILL.md`), the `backups/` snapshots, the undo pointer, and the lock
file. It **never touches `settings.json` or `.claude.json`** (run `cpm undo` first if
you want to revert plugin/MCP changes). If the MCP store contains disabled servers
not in `.claude.json`, `cpm uninstall` offers to restore them first. Because the
profiles config is your own authored data, it asks before deleting it.

```bash
cpm uninstall --dry-run     # show exactly what would be removed, change nothing
cpm uninstall --keep-config # remove everything except your profiles config
cpm uninstall --purge -y    # remove everything, no prompts
```

> Installed from source with `npm link`? Use `npm rm -g @sweets999/claude-plugin-manager`
> (or `npm unlink`) for the last step instead.

## Development

```bash
git clone https://github.com/Sweets999/claude-plugin-manager && cd claude-plugin-manager
npm install && npm link
npm test          # node --test
```

Core logic (`config`, `plugins`, `planner`, `settings`) is pure and unit-tested;
the command layer is a thin shell over it. Contributor setup and conventions live
in [`CONTRIBUTING.md`](CONTRIBUTING.md); user-visible changes in
[`CHANGELOG.md`](CHANGELOG.md). Future ideas and the backlog live in
[`docs/ideas/`](docs/ideas/).
