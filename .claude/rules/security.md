# Secrets & sensitive data (enforced — this repo is open source)

`cpm` is a public, MIT-licensed project, and it operates directly on the user's
real Claude config (`~/.claude/settings.json`, `~/.claude.json`, the MCP store).
Anything committed here is published to npm and visible on GitHub forever. Treat
every file — code, tests, fixtures, docs, examples, commit messages — as public.

## NEVER commit real secrets or personal identifiers

Do not add, paste, or hardcode any of the following, even in a test, example, or
comment:

- API keys, tokens, bearer/OAuth credentials, passwords, private keys, `.env`
  contents.
- Real **MCP server secrets** — `env`/`headers` values from `~/.claude.json`
  (e.g. `ANTHROPIC_API_KEY`, `Authorization`, third-party API tokens).
- Real account / cloud / org identifiers: cloud IDs, account IDs, project IDs,
  tenant/cloudId UUIDs, internal hostnames, private URLs, email addresses, real
  usernames.
- Real machine paths that leak identity (e.g. `/Users/<realname>/...`) in
  committed fixtures or docs.

## Use placeholders instead

Sample config, README snippets, and test data MUST use obvious fakes:
`acme`, `marketplace`, `name@marketplace`, `example.com`, `<your-token>`,
`sk-xxxx`, `U0EXAMPLE`. Test IO already redirects to `os.tmpdir()` via `CPM_*`
overrides — keep generated/sample data synthetic.

## Handling real config at runtime is fine; logging it is not

The tool reads/writes real config by design. But do NOT print secret values to
stdout/stderr, write them into backups that land in the repo, or include them in
error messages. When showing MCP servers, show names/shape, not secret `env`
values.

## Before finishing any change

- Scan the diff for the above before declaring done; if you spot a secret, stop and
  flag it rather than committing.
- Never weaken `.gitignore` to track real local config, backups, or `*.log`.
- If you genuinely need an example credential, make it visibly fake and inert.
