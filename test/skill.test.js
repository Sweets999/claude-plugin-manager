import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolvePaths } from '../src/paths.js';
import { buildSkillDoc, installSkill, removeSkill } from '../src/skill.js';
import { planUninstall, removeCpmFiles } from '../src/uninstall.js';

function tmpPaths() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cpm-skill-'));
  return resolvePaths({ env: {}, home });
}

test('buildSkillDoc has YAML frontmatter and defers to `cpm help`', () => {
  const doc = buildSkillDoc();
  assert.match(doc, /^---\n/);
  assert.match(doc, /\nname: cpm\n/);
  assert.match(doc, /\ndescription:/);
  assert.match(doc, /cpm help/, 'skill should point at the authoritative CLI guide');
});

test('installSkill writes skills/cpm/SKILL.md and is idempotent', () => {
  const paths = tmpPaths();
  const written = installSkill(paths);
  assert.equal(written, paths.skillFile);
  assert.ok(written.endsWith(path.join('skills', 'cpm', 'SKILL.md')));
  assert.equal(fs.readFileSync(paths.skillFile, 'utf8'), buildSkillDoc());

  // second install just refreshes it — no throw, content unchanged
  installSkill(paths);
  assert.equal(fs.readFileSync(paths.skillFile, 'utf8'), buildSkillDoc());
});

test('removeSkill deletes the file and the emptied cpm/ dir; idempotent', () => {
  const paths = tmpPaths();
  installSkill(paths);

  assert.equal(removeSkill(paths), true);
  assert.equal(fs.existsSync(paths.skillFile), false);
  assert.equal(fs.existsSync(paths.skillDir), false, 'empty skills/cpm dir removed');

  // nothing left to remove
  assert.equal(removeSkill(paths), false);
});

test('removeSkill keeps skills/cpm/ if the user added other files', () => {
  const paths = tmpPaths();
  installSkill(paths);
  const extra = path.join(paths.skillDir, 'notes.md');
  fs.writeFileSync(extra, 'mine');

  removeSkill(paths);
  assert.equal(fs.existsSync(paths.skillFile), false);
  assert.equal(fs.existsSync(extra), true, 'foreign file left untouched');
  assert.equal(fs.existsSync(paths.skillDir), true, 'dir kept while non-empty');
});

test('cpm uninstall plans and removes the skill artifact', () => {
  const paths = tmpPaths();
  installSkill(paths);

  const plan = planUninstall(paths, { includeProtected: false });
  const skill = plan.targets.find((t) => t.key === 'skill');
  assert.ok(skill, 'skill is an uninstall target');
  assert.equal(skill.exists, true);

  removeCpmFiles(paths, { includeProtected: false });
  assert.equal(fs.existsSync(paths.skillFile), false, 'uninstall removes the skill');
  assert.equal(fs.existsSync(paths.skillDir), false, 'and its emptied dir');
});
