import { spawnSync as defaultSpawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CpmError } from './errors.js';

export function buildRunArgs(
  tmpSettingsPath,
  passthrough = [],
  { mcpConfigPath = null, strictMcp = true } = {},
) {
  return [
    '--settings',
    tmpSettingsPath,
    ...(mcpConfigPath
      ? ['--mcp-config', mcpConfigPath, ...(strictMcp ? ['--strict-mcp-config'] : [])]
      : []),
    ...passthrough,
  ];
}

// Shells whose `-i -c '<cmd>' <name> <args...>` reliably sources the rc file and
// forwards positional args via "$@". This is the POSIX family; fish/csh/tcsh use
// different positional syntax ($argv, not "$@"), so we never shell-wrap those —
// we'd silently drop --settings. Whitelist (not blacklist) so an unknown shell
// degrades safely to a direct call rather than a broken one.
const POSIX_SHELLS = new Set(['sh', 'bash', 'zsh', 'ksh', 'dash', 'ash', 'mksh', 'busybox']);

export function isPosixShell(shellPath) {
  if (!shellPath) return false;
  const base = shellPath.split('/').pop();
  return POSIX_SHELLS.has(base);
}

// Command + argv used to launch claude. By default we go *through the user's
// interactive shell* (`$SHELL -i -c 'claude "$@"' claude <args>`) so that a
// `claude` alias / shell-function wrapper — and any environment it injects — is
// honored, exactly as if the user had typed `claude` themselves. `-i` sources
// the rc file where such wrappers live; passing args as real argv after `$0`
// avoids any quoting/escaping. When not using the shell we spawn the binary
// directly (the `CPM_CLAUDE_BIN` escape hatch, or non-TTY/automation contexts).
export function buildSpawnInvocation(claudeBin, runArgs, { shell, useShell } = {}) {
  if (useShell && shell) {
    return { command: shell, args: ['-i', '-c', 'claude "$@"', 'claude', ...runArgs] };
  }
  return { command: claudeBin, args: runArgs };
}

// Launch `claude` for a single session with `desired` plugins, via a temp
// settings file containing only enabledPlugins (which overrides — not merges —
// so all other user settings fall through). Global config is never touched.
// When `mcpServers` is provided we also write a temp `--mcp-config` file and pass
// `--strict-mcp-config` so ONLY the profile's user MCP servers are active (an empty
// `{}` is meaningful — it isolates to zero user MCPs; plugin MCPs are separate).
export function runWithProfile(
  ctx,
  desired,
  passthrough = [],
  {
    spawn = defaultSpawn,
    tmpDir = os.tmpdir(),
    env = ctx.env || process.env,
    isTTY = Boolean(process.stdout && process.stdout.isTTY),
    mcpServers = null,
    strictMcp = true,
  } = {},
) {
  const stamp = `cpm-${process.pid}-${Date.now()}`;
  const tmp = path.join(tmpDir, `${stamp}.settings.json`);
  fs.writeFileSync(tmp, JSON.stringify({ enabledPlugins: desired }, null, 2) + '\n');

  let mcpTmp = null;
  if (mcpServers != null) {
    mcpTmp = path.join(tmpDir, `${stamp}.mcp.json`);
    fs.writeFileSync(mcpTmp, JSON.stringify({ mcpServers }, null, 2) + '\n');
  }

  const cleanup = () => {
    for (const f of [tmp, mcpTmp]) {
      if (!f) continue;
      try {
        fs.unlinkSync(f);
      } catch {
        /* already gone */
      }
    }
  };
  // Belt-and-braces: also clean up if the process is killed mid-session.
  process.once('exit', cleanup);

  // Honor a `claude` wrapper (alias/function + the env it injects) by going
  // through the user's shell — but only with a real TTY, a POSIX-family $SHELL,
  // and when the user hasn't pinned a binary via CPM_CLAUDE_BIN (which forces a
  // direct call). Anything else degrades to a direct call.
  const useShell = !env.CPM_CLAUDE_BIN && isTTY && isPosixShell(env.SHELL);
  const { command, args } = buildSpawnInvocation(
    ctx.paths.claudeBin,
    buildRunArgs(tmp, passthrough, { mcpConfigPath: mcpTmp, strictMcp }),
    { shell: env.SHELL, useShell },
  );

  try {
    const res = spawn(command, args, { stdio: 'inherit' });
    if (res && res.error) {
      if (res.error.code === 'ENOENT') {
        throw new CpmError(
          `Could not run \`${command}\`. ` +
            'Make sure claude is on PATH, or set CPM_CLAUDE_BIN to its path.',
          1,
        );
      }
      throw res.error;
    }
    if (res && res.signal) return 1;
    return res && typeof res.status === 'number' ? res.status : 0;
  } finally {
    cleanup();
  }
}
