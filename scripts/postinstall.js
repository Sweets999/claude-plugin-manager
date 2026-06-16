#!/usr/bin/env node
// Runs after `npm install`. Installs the bundled Claude skill so that, right
// after a global install, the user can just say "set up cpm" and Claude knows
// how to drive it.
//
// MUST be bulletproof — a postinstall that throws breaks the whole install:
//   - only acts on GLOBAL installs (so `npm install` in a dev clone, CI, and
//     being-a-dependency never write to ~/.claude),
//   - skips when CPM_NO_POSTINSTALL is set,
//   - swallows every error and always exits 0.
import { resolvePaths } from '../src/paths.js';
import { installSkill } from '../src/skill.js';

async function main() {
  // npm sets npm_config_global=true only for `-g` installs.
  if (process.env.npm_config_global !== 'true') return;
  if (process.env.CPM_NO_POSTINSTALL) return;

  const paths = resolvePaths({ env: process.env });
  const written = installSkill(paths);
  process.stdout.write(
    `cpm: installed Claude skill → ${written}\n` +
      '     tell Claude "set up cpm" to configure your profiles.\n',
  );
}

main().catch(() => {
  /* never fail an install over the skill — it can be (re)added with `cpm skill install` */
});
