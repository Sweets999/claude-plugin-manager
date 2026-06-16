---
paths:
  - "test/**/*.js"
  - "src/**/*.js"
---

# Test structure & discipline (enforced)

`npm test` (`node --test`) is the ONLY check in this repo — there is no linter and
no build step. Tests must stay fast, hermetic, and self-contained.

## File layout

- One test file per module: `test/<module>.test.js` (e.g. `src/planner.js` →
  `test/planner.test.js`). Do NOT create nested test directories or alternate
  suffixes.
- Use the built-in runner only: `import { test } from 'node:test';` and
  `import assert from 'node:assert/strict';`. Do NOT add Jest, Mocha, Vitest, or
  any other test framework or assertion library.

## Hermetic — never touch the real environment

- Tests MUST NOT read or write the real `~/.claude`, `~/.claude.json`, or the
  user's config, and MUST NOT invoke the real `claude` CLI.
- Redirect all IO to `os.tmpdir()` via a fresh `fs.mkdtempSync(...)` dir and the
  `CPM_*` path overrides / injected fakes (see `test/settings.test.js` and
  `test/runner.test.js` for the established pattern). Each test creates its own
  temp dir; do not share mutable state between tests.

## What to test

- Prefer testing the **pure core directly** (`config`, `plugins`, `mcp`,
  `planner`) — it needs no IO and is where logic should live.
- ALL new behaviour ships with tests in the same change. A bug fix gets a
  regression test. Do not mark work done while `npm test` is red.

## Running

```bash
npm test                                       # everything
node --test test/planner.test.js               # one file
node --test --test-name-pattern="computeExclusiveSet"  # by name
```

CI runs the suite on Node 18/20/22 × Ubuntu/macOS — keep tests OS-agnostic (use
`path.join`, `os.tmpdir()`; no hardcoded `/tmp` or `\` separators).
