# Demo recordings

The README GIFs are recorded with [VHS](https://github.com/charmbracelet/vhs).
Each `.tape` is a script VHS plays in a headless terminal and renders to a GIF.

## Re-record

From the repo root, with `vhs` installed (`brew install vhs`):

```bash
vhs scripts/demo/hero.tape       # -> docs/demo.gif        (status → ls → diff → focus)
vhs scripts/demo/use-undo.tape   # -> docs/demo-use-undo.gif (use → status → undo)
```

## How it stays hermetic

The demos must never expose real, machine-specific plugins or MCP servers, so
they run against a **fully fictional sandbox** — `core` / `docker` / `playwright`
/ `jupyter` / `code-review` plugins and `github` / `sentry` / `postgres` / `linear`
MCP servers, none of them real.

- [`setup.mjs`](setup.mjs) builds a throwaway `$HOME` under `.sandbox/`
  (gitignored): a profiles config, `settings.json`, `.claude.json`, and an
  installed-plugins universe.
- [`fake-claude`](fake-claude) is a stub `claude` binary. cpm shells out to
  `claude plugin list --json` / `claude mcp list` for discovery and to launch
  `cpm run`; the stub answers from the sandbox and prints a fake session banner,
  so the real Claude install (and its real plugins) is never invoked.
- [`demo-env.sh`](demo-env.sh) is sourced (hidden) at the top of each tape: it
  rebuilds the sandbox, exports the `CPM_*` overrides that point cpm at it, and
  defines a `cpm` shell function resolving to this checkout.

Because the sandbox is rebuilt on every run, recordings are deterministic — re-run
a tape and you get the same output.

To poke at the sandbox by hand:

```bash
source scripts/demo/demo-env.sh
cpm status
```
