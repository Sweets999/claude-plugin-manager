import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// The bundled Claude Code skill lives as a real, browsable file in the repo at
// skills/cpm/SKILL.md (so it's easy to find on GitHub and ships in the package).
// installSkill copies it verbatim to ~/.claude/skills/cpm/SKILL.md so that, once
// cpm is installed, a user can just say "set up cpm" and Claude knows how to
// drive it. Deliberately THIN — the authoritative reference is `cpm help` (see
// bin/cpm.js printGuide), so the guidance lives in one place and can't drift.
const SKILL_SRC = fileURLToPath(new URL('../skills/cpm/SKILL.md', import.meta.url));

export function buildSkillDoc() {
  return fs.readFileSync(SKILL_SRC, 'utf8');
}

// Write the skill into ~/.claude/skills/cpm/. Idempotent: the file is cpm-managed
// and refreshed on every install/upgrade. Returns the path written.
export function installSkill(paths) {
  fs.mkdirSync(paths.skillDir, { recursive: true });
  fs.writeFileSync(paths.skillFile, buildSkillDoc());
  return paths.skillFile;
}

// Remove the skill file and its cpm/ dir if cpm emptied it. Idempotent: a missing
// file is fine. Returns true if a file was actually removed.
export function removeSkill(paths) {
  let removed = false;
  try {
    fs.unlinkSync(paths.skillFile);
    removed = true;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  try {
    if (fs.existsSync(paths.skillDir) && fs.readdirSync(paths.skillDir).length === 0) {
      fs.rmdirSync(paths.skillDir);
    }
  } catch {
    /* not empty / race — leave it */
  }
  return removed;
}
