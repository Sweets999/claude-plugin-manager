import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/cli.js';
import { ALIAS_TO_NAME } from '../src/commands.js';
import { UsageError } from '../src/errors.js';

test('bare invocation defaults to status', () => {
  const p = parseArgs([]);
  assert.equal(p.command, 'status');
  assert.deepEqual(p.args, []);
  assert.deepEqual(p.passthrough, []);
});

test('a known verb keeps its name and collects args', () => {
  const p = parseArgs(['use', 'dev']);
  assert.equal(p.command, 'use');
  assert.deepEqual(p.args, ['dev']);
});

test('list stays "list" at parse level; bin resolves the alias', () => {
  const p = parseArgs(['list']);
  assert.equal(p.command, 'list');
  assert.equal(ALIAS_TO_NAME.get('list'), 'ls');
});

test('a bare (unknown) first arg routes to run', () => {
  const p1 = parseArgs(['focus']);
  assert.equal(p1.command, 'run');
  assert.deepEqual(p1.args, ['focus']);

  const p2 = parseArgs(['focus', 'x']);
  assert.equal(p2.command, 'run');
  assert.deepEqual(p2.args, ['focus', 'x']);
});

test('everything after -- is captured as passthrough', () => {
  const p = parseArgs(['run', 'dev', '--', '--resume', '-p']);
  assert.equal(p.command, 'run');
  assert.deepEqual(p.args, ['dev']);
  assert.deepEqual(p.passthrough, ['--resume', '-p']);
});

test('short flags bundle (-ny -> dry-run + yes)', () => {
  const p = parseArgs(['use', 'dev', '-ny']);
  assert.equal(p.flags['dry-run'], true);
  assert.equal(p.flags.yes, true);
});

test('unknown short flag throws UsageError', () => {
  assert.throws(() => parseArgs(['use', '-z']), UsageError);
});

test('value flags consume the next token, or =value', () => {
  assert.equal(parseArgs(['ls', '--config', 'x']).flags.config, 'x');
  assert.equal(parseArgs(['ls', '--config=x']).flags.config, 'x');
});

test('a value flag missing its value throws UsageError', () => {
  assert.throws(() => parseArgs(['--config']), UsageError);
});

test('-h sets flags.help but the command stays status', () => {
  const p = parseArgs(['-h']);
  assert.equal(p.command, 'status');
  assert.equal(p.flags.help, true);
});

test('the help verb resolves to the help command', () => {
  assert.equal(parseArgs(['help']).command, 'help');
});

test('boolean long flags are set to true', () => {
  assert.equal(parseArgs(['ls', '--json']).flags.json, true);
});

test('short flags alias to their long forms', () => {
  const p = parseArgs(['use', 'dev', '-n', '-y', '-q']);
  assert.equal(p.flags['dry-run'], true);
  assert.equal(p.flags.yes, true);
  assert.equal(p.flags.quiet, true);
  assert.equal(parseArgs(['ls', '--no-color']).flags['no-color'], true);
});

test('a value flag after -- is passthrough, not parsed', () => {
  const p = parseArgs(['run', 'dev', '--', '--config', 'x']);
  assert.deepEqual(p.args, ['dev']);
  assert.deepEqual(p.passthrough, ['--config', 'x']);
  assert.equal(p.flags.config, undefined);
});
