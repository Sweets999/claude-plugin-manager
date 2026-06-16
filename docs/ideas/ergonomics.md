# Ergonomics — a cluster of small UX wins

Status: 💡 idea (several independent, low-effort items)

## Shell completion
`cpm completion <bash|zsh|fish>` prints a completion script. Complete:
- subcommands (`use`, `run`, `ls`, …)
- combo names for `use`/`run`/`diff` (read from the config's `profiles` keys)

Low effort, big day-to-day payoff (combo names are the thing you type most).

## `cpm which <plugin>`
Reverse lookup: given a plugin id (bare or full), list which combos include it
(after `extends`/`base` resolution). Handy when editing combos or deciding where a
plugin belongs. Reuses `resolveProfileEntries` + `resolveEntries` across all
profiles.

## Closest-combo suggestion in `status`
When the current enabled set matches no combo exactly, show the **nearest** combo
by smallest symmetric difference, plus the delta (`+x`, `-y`), and offer
`cpm save`. The design review suggested this; `status` currently reports only exact
matches. Compute with the set helpers already in `src/commands/status.js` +
`src/planner.js` `diff`.

## Ad-hoc tweaks without editing the config
- `cpm enable <plugin>` / `cpm disable <plugin>` — nudge the current enabled set by
  one plugin (non-exclusive), for quick experiments. (We chose combo-only for MVP;
  these would complement it.)
- `cpm run <combo> --with <plugin> [--without <plugin>]` — launch a combo plus/minus
  a plugin for one session, without creating a new combo. Pairs well with the
  isolated `run` model.

## Per-command help
`cpm help <command>` → focused help for one subcommand (flags, examples). Help text
is already centralised in `bin/cpm.js`.

## Notes
These are independent; pick off whichever is most useful first. Completion and
`which` are the cheapest. Ad-hoc `--with`/`enable` change the mental model slightly
(non-exclusive edits) so decide if that's desirable before adding.
