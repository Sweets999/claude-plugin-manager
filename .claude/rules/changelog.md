---
paths:
  - "src/**/*.js"
  - "bin/**/*.js"
  - "scripts/**/*.js"
  - "README.md"
  - "CHANGELOG.md"
---

# Changelog discipline (enforced)

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project follows [Semantic Versioning](https://semver.org/). It is maintained
**by hand** — `semantic-release` cuts versions/tags from commits but does NOT write
the changelog. If you skip this, the release notes are wrong.

## When a changelog entry is REQUIRED

Any user-facing or contract change: new/changed/removed command, flag, or alias;
config-shape change; changed output, exit codes, or error messages; new env var;
file paths written; published `files`/skill behaviour. Pure internal refactors with
no observable change do NOT need an entry.

## How to add it

- Add the entry under the `## [Unreleased]` section, in the correct category:
  **Added · Changed · Deprecated · Removed · Fixed · Security** (create the
  subsection if missing). Keep `[Unreleased]` at the top; never invent a version
  number — `semantic-release` assigns it on merge.
- Write for users, not implementers: lead with the behaviour, **bold** the
  command/flag/term, and note breaking changes explicitly.

## Keep the three surfaces in sync

A user-facing change MUST update all of: `CHANGELOG.md`, `README.md`, and the
`cpm help` text in `bin/cpm.js`. Use the current tool name **`cpm`** (per
`package.json`), not the legacy `cps`.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:` → minor, `fix:` → patch, plus `chore:`/`docs:`/…). Avoid `feat!:` /
`BREAKING CHANGE:` until we intend to ship `1.0.0`.
