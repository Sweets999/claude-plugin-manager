import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderPlan } from '../src/render.js';
import { detectProjectOverride } from '../src/discover.js';

const id = (s) => String(s);
const fakeUi = { c: { bold: id, dim: id, red: id, green: id, yellow: id, cyan: id } };

test('renderPlan shows enabled, newly-added and removed plugins', () => {
  const plan = {
    resolved: ['a@m', 'b@m'],
    unknown: [],
    changes: { enable: ['b@m'], disable: ['c@m'], unchanged: ['a@m'] },
  };
  const out = renderPlan(fakeUi, 'demo', plan);
  assert.match(out, /Profile "demo"/);
  assert.match(out, /\+ b@m/);
  assert.match(out, /• a@m/);
  assert.match(out, /- c@m/);
});

test('detectProjectOverride flags a cwd .claude/settings.json with enabledPlugins', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpm-proj-'));
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  assert.deepEqual(detectProjectOverride({ cwd: dir }), []);

  fs.writeFileSync(
    path.join(dir, '.claude', 'settings.json'),
    JSON.stringify({ enabledPlugins: { 'a@m': true } }),
  );
  const hits = detectProjectOverride({ cwd: dir });
  assert.equal(hits.length, 1);
  assert.match(hits[0], /\.claude\/settings\.json$/);
});
