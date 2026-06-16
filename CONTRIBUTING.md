# Contributing to cps

Thanks for taking a look. `cps` is small, dependency-light, and meant to stay that
way. This guide covers everything you need to make a change with confidence.

## Setup

```bash
git clone https://github.com/Sweets999/claude-plugin-swapper && cd claude-plugin-swapper
npm install        # installs the single runtime dep (jsonc-parser) + dev nothing extra
npm link           # optional: put `cps` on your PATH for manual testing
```

Requires **Node ≥ 18**. There is **no build step and no linter** — the source is
plain ES modules run directly. `npm test` is the only check.

## Running tests

```bash
npm test                                   # run everything (node --test)
node --test test/planner.test.js           # a single file
node --test --test-name-pattern="parseArgs"  # tests matching a name
```

Tests redirect all IO to `os.tmpdir()` via fakes and path overrides — they never
touch your real `~/.claude` or invoke the real `claude` CLI, so they're safe to run
anywhere (including CI). CI runs the suite on Node 18/20/22 × Ubuntu/macOS.

## Architecture in one paragraph

The codebase is split into a **pure core** (no IO, fully unit-tested) and a **thin
IO/command shell** around it. Keep decisions in the pure layer and keep
`src/commands/` dumb — a command should parse args, call into the core/discover
layer, and render via `ctx.ui`, nothing more. The pure modules are `config.js`,
`plugins.js`, `mcp.js`, and `planner.js`; the IO layer is `settings.js`,
`discover.js`, `runner.js`, and `paths.js`. See [`AGENTS.md`](AGENTS.md) for the
full module map.

## Conventions

- **ES modules only** (`"type": "module"`). Imports **must** include the `.js`
  extension (e.g. `import { x } from './config.js'`).
- **Errors are typed and carry exit codes** (`src/errors.js`). Throw the right
  `CpsError` subclass instead of calling `process.exit`; `bin/cps.js` catches them.
  The codes are: `0` ok · `2` usage · `3` unknown profile · `4`
  validation/ambiguity · `5` malformed config/settings.
- **`use` is persistent and reversible; `run` never touches global config.**
  Anything that mutates global state must back up the prior content and write an
  undo pointer (go through `applyProfile` for multi-file writes).
- **Adding a command = one registry entry + one file.** Add the entry to
  `COMMANDS` in `src/commands.js` and create `src/commands/<name>.js` exporting
  `default async (ctx) => exitCode`. The CLI parser and both help texts derive from
  the registry automatically; `test/commands.test.js` guards against drift.
- **Stay dependency-light.** The runtime has exactly one dependency
  (`jsonc-parser`). Please don't add more without a strong reason.
- Match the surrounding code's style: comment density, naming, and idiom.

## Commit messages

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
(`fix:`, `feat:`, `chore:`, `docs:`, …) because releases are automated: on merge to
`main`, [semantic-release](https://semantic-release.gitbook.io/) reads the commit
prefixes to pick the next version, publish to npm, update `CHANGELOG.md`, and cut a
GitHub Release. `fix:` → patch, `feat:` → minor. Avoid `feat!:` / `BREAKING CHANGE:`
until we intend to ship `1.0.0` — they force a major bump.

## Before opening a PR

1. `npm test` is green.
2. New behaviour has tests (prefer testing the pure core directly).
3. User-facing or contract changes are reflected in `README.md`, `cps help`
   (`bin/cps.js`), and `CHANGELOG.md`.
