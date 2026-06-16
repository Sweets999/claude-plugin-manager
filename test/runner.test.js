import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  runWithProfile,
  buildRunArgs,
  buildSpawnInvocation,
  isPosixShell,
} from '../src/runner.js';
import { CpmError } from '../src/errors.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpm-run-'));

test('buildRunArgs puts --settings first, then passthrough', () => {
  assert.deepEqual(buildRunArgs('/x.json', ['--version', '-p']), [
    '--settings',
    '/x.json',
    '--version',
    '-p',
  ]);
});

test('buildRunArgs inserts --mcp-config + --strict-mcp-config when given a path', () => {
  assert.deepEqual(
    buildRunArgs('/x.json', ['--resume'], { mcpConfigPath: '/m.json' }),
    ['--settings', '/x.json', '--mcp-config', '/m.json', '--strict-mcp-config', '--resume'],
  );
  // without a path: no mcp flags
  assert.deepEqual(buildRunArgs('/x.json', ['--resume']), [
    '--settings',
    '/x.json',
    '--resume',
  ]);
});

test('runWithProfile writes a temp mcp file, passes --mcp-config + --strict, cleans up both', () => {
  let captured;
  const spawn = (bin, args) => {
    const mcpIdx = args.indexOf('--mcp-config');
    const mcpPath = args[mcpIdx + 1];
    captured = {
      args,
      mcpIdx,
      mcpPath,
      settingsPath: args[args.indexOf('--settings') + 1],
      mcpExisted: fs.existsSync(mcpPath),
      mcpContent: fs.readFileSync(mcpPath, 'utf8'),
      hasStrict: args.includes('--strict-mcp-config'),
    };
    return { status: 0 };
  };
  const ctx = { paths: { claudeBin: 'claude-fake' } };
  const code = runWithProfile(ctx, { 'a@m': true }, ['--x'], {
    spawn,
    tmpDir,
    isTTY: false,
    mcpServers: { srv: { command: 'foo' } },
  });

  assert.equal(code, 0);
  assert.ok(captured.mcpIdx !== -1, '--mcp-config present');
  assert.ok(captured.hasStrict, '--strict-mcp-config present');
  assert.ok(captured.mcpExisted, 'temp mcp file existed during spawn');
  assert.deepEqual(JSON.parse(captured.mcpContent), {
    mcpServers: { srv: { command: 'foo' } },
  });
  // both temp files cleaned up
  assert.equal(fs.existsSync(captured.settingsPath), false, 'settings temp cleaned up');
  assert.equal(fs.existsSync(captured.mcpPath), false, 'mcp temp cleaned up');
});

test('runWithProfile writes a temp settings file, forwards args, returns status, cleans up', () => {
  let captured;
  const spawn = (bin, args) => {
    captured = {
      bin,
      args,
      existed: fs.existsSync(args[1]),
      content: fs.readFileSync(args[1], 'utf8'),
    };
    return { status: 7 };
  };
  const ctx = { paths: { claudeBin: 'claude-fake' } };
  const code = runWithProfile(ctx, { 'a@m': true }, ['--version'], {
    spawn,
    tmpDir,
    isTTY: false,
  });

  assert.equal(code, 7);
  assert.equal(captured.bin, 'claude-fake');
  assert.equal(captured.args[0], '--settings');
  assert.deepEqual(captured.args.slice(2), ['--version']);
  assert.ok(captured.existed, 'temp file should exist during spawn');
  assert.deepEqual(JSON.parse(captured.content).enabledPlugins, { 'a@m': true });
  assert.equal(fs.existsSync(captured.args[1]), false, 'temp file should be cleaned up');
});

test('runWithProfile raises a friendly CpmError when claude is not found', () => {
  const spawn = () => ({ error: Object.assign(new Error('nope'), { code: 'ENOENT' }) });
  assert.throws(
    () =>
      runWithProfile({ paths: { claudeBin: 'claude' } }, {}, [], {
        spawn,
        tmpDir,
        isTTY: false,
      }),
    CpmError,
  );
});

test('buildSpawnInvocation: direct binary call by default', () => {
  assert.deepEqual(buildSpawnInvocation('claude', ['--settings', '/x.json']), {
    command: 'claude',
    args: ['--settings', '/x.json'],
  });
});

test('buildSpawnInvocation: launches via the shell so a claude wrapper is honored', () => {
  assert.deepEqual(
    buildSpawnInvocation('claude', ['--settings', '/x.json', '-p'], {
      shell: '/bin/zsh',
      useShell: true,
    }),
    {
      command: '/bin/zsh',
      args: ['-i', '-c', 'claude "$@"', 'claude', '--settings', '/x.json', '-p'],
    },
  );
});

test('runWithProfile goes through $SHELL when on a TTY and CPM_CLAUDE_BIN is unset', () => {
  let captured;
  const spawn = (bin, args) => {
    captured = { bin, args, tmp: args[args.indexOf('--settings') + 1] };
    return { status: 0 };
  };
  const ctx = { paths: { claudeBin: 'claude' } };
  const code = runWithProfile(ctx, { 'a@m': true }, ['--resume'], {
    spawn,
    tmpDir,
    env: { SHELL: '/bin/zsh' },
    isTTY: true,
  });

  assert.equal(code, 0);
  assert.equal(captured.bin, '/bin/zsh');
  assert.deepEqual(captured.args.slice(0, 4), ['-i', '-c', 'claude "$@"', 'claude']);
  assert.deepEqual(captured.args.slice(4), ['--settings', captured.tmp, '--resume']);
  assert.equal(fs.existsSync(captured.tmp), false, 'temp file should be cleaned up');
});

test('runWithProfile: CPM_CLAUDE_BIN forces a direct call even on a TTY', () => {
  let captured;
  const spawn = (bin) => {
    captured = { bin };
    return { status: 0 };
  };
  const ctx = { paths: { claudeBin: '/opt/claude' } };
  runWithProfile(ctx, {}, [], {
    spawn,
    tmpDir,
    env: { SHELL: '/bin/zsh', CPM_CLAUDE_BIN: '/opt/claude' },
    isTTY: true,
  });
  assert.equal(captured.bin, '/opt/claude');
});

test('runWithProfile: direct call on a TTY when no SHELL is set', () => {
  let captured;
  const spawn = (bin) => {
    captured = { bin };
    return { status: 0 };
  };
  const ctx = { paths: { claudeBin: 'claude' } };
  runWithProfile(ctx, {}, [], { spawn, tmpDir, env: {}, isTTY: true });
  assert.equal(captured.bin, 'claude');
});

test('isPosixShell recognizes the POSIX family and rejects fish/csh/empty', () => {
  for (const sh of ['/bin/zsh', '/bin/bash', '/bin/sh', '/usr/bin/ksh', '/bin/dash']) {
    assert.equal(isPosixShell(sh), true, sh);
  }
  for (const sh of ['/usr/bin/fish', '/bin/tcsh', '/bin/csh', '', undefined]) {
    assert.equal(isPosixShell(sh), false, String(sh));
  }
});

test('runWithProfile: non-POSIX shell (fish) falls back to a direct call', () => {
  let captured;
  const spawn = (bin, args) => {
    captured = { bin, args };
    return { status: 0 };
  };
  const ctx = { paths: { claudeBin: 'claude' } };
  runWithProfile(ctx, {}, [], {
    spawn,
    tmpDir,
    env: { SHELL: '/usr/bin/fish' },
    isTTY: true,
  });
  // direct call keeps --settings, so the profile is never silently dropped
  assert.equal(captured.bin, 'claude');
  assert.equal(captured.args[0], '--settings');
});
