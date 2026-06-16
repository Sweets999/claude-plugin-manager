import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildStarterConfig } from './init.js';
import { readEnabledPlugins } from '../settings.js';
import { enabledList } from '../planner.js';

export default async function edit(ctx) {
  const cfg = ctx.paths.config;
  if (!fs.existsSync(cfg)) {
    let ids = [];
    try {
      ids = enabledList(readEnabledPlugins(ctx.paths.settings));
    } catch {
      /* none */
    }
    fs.mkdirSync(path.dirname(cfg), { recursive: true });
    fs.writeFileSync(cfg, buildStarterConfig(ids));
    ctx.ui.info(`Created ${cfg}`);
  }
  const editor = ctx.env.VISUAL || ctx.env.EDITOR || 'vi';
  const res = spawnSync(editor, [cfg], { stdio: 'inherit' });
  if (res.error) {
    ctx.ui.error(`could not launch editor "${editor}": ${res.error.message}`);
    return 1;
  }
  return res.status ?? 0;
}
