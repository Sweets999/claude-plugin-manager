---
paths:
  - "src/**/*.js"
  - "bin/**/*.js"
  - "scripts/**/*.js"
  - "*.md"
  - "docs/**/*.md"
---

# Keep docs in sync with the code (enforced)

Docs in this repo are the contract for users and for future agents — stale docs are
worse than none. Any change that alters behaviour, structure, or contract MUST
update the relevant docs **in the same change**, not "later".

## Which doc tracks what

- **`README.md`** — user-facing: install, quick start, every command/flag/alias,
  example profiles, config shape, FAQ. Update it for any user-visible change.
- **`AGENTS.md`** — the architecture/module map for agents. Update it when you
  add/rename/move a module, change the layering, add a command, change paths/env
  vars, exit codes, or the `use`/`run` invariant.
- **`cpm help` (`bin/cpm.js`)** — the in-CLI guide. Keep it consistent with
  README; it derives from the `COMMANDS` registry, so new commands flow through if
  you add the registry entry.
- **`CONTRIBUTING.md`** — setup/test/convention changes for contributors.
- **`CHANGELOG.md`** — see the changelog rule; required for user-facing changes.
- **`docs/`** — design notes / backlog. When you ship something previously only
  designed there, move/update the note so `docs/` doesn't describe the present as
  future (and vice-versa for deferred work).

## Rules

- A user-facing or contract change keeps these in sync: `README.md` +
  `cpm help` (`bin/cpm.js`) + `CHANGELOG.md`. An architectural change also updates
  `AGENTS.md`.
- Use the current tool name **`cpm`** and the **`CPM_*`** env vars (per
  `package.json`) consistently — do not introduce or copy the legacy `cps` / `CPS_`
  naming. If you touch a doc still using the old name, correct it.
- Keep examples runnable and accurate: command names, flags, config keys, and exit
  codes in docs must match the code. Verify a snippet before documenting it.
- Don't let docs contradict each other. README, AGENTS, and `cpm help` must agree
  on command names, behaviour, and defaults.
