# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-16

First public-release cleanup. Pre-1.0, so the config-shape change below is a
breaking change shipped as a minor bump.

### Changed

- **BREAKING — config `base` is now a nested object.** Global defaults move from
  two top-level keys into one:

  ```jsonc
  // before
  "base": ["core@acme"],
  "mcpBase": ["linear"],

  // after
  "base": {
    "plugins": ["core@acme"],
    "mcp": ["linear"]
  }
  ```

  A profile's `"base": false` still opts out of **both** `base.plugins` and
  `base.mcp`. The old top-level array `base` and the `mcpBase` key are no longer
  accepted: a config using either now fails fast with a message explaining the new
  shape (exit code `5`). There is no silent auto-migration — edit your
  `~/.claude/cps.profiles.jsonc` by hand (the error tells you exactly what to do).
- **Terminology unified to "profile".** All user-facing text now says "profile"
  instead of "combo". On-disk contracts are unchanged: the config key is still
  `profiles`, the file is still `cps.profiles.jsonc`, and the undo pointer keys are
  unchanged — so this is a wording-only change with no migration.

### Added

- **Single-source command registry** (`src/commands.js`). Commands are declared
  once; the CLI parser and both help texts derive from it. Adding a command is now
  one registry entry plus a `src/commands/<name>.js` file.
- **CI** (`.github/workflows/ci.yml`): runs `npm test` on Node 18/20/22 across
  Ubuntu and macOS for every push and pull request.
- **Tests** for `parseArgs` (`test/cli.test.js`) and for command-registry/file
  drift (`test/commands.test.js`).
- `CHANGELOG.md` and `CONTRIBUTING.md`.

### Removed

- **The `--cost` flag.** It was advertised but only ever printed "not implemented
  yet". The intended design is retained in
  [`docs/ideas/context-cost-budgeting.md`](docs/ideas/context-cost-budgeting.md).

[0.2.0]: https://github.com/Sweets999/claude-plugin-swapper/releases/tag/v0.2.0
