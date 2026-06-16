import { installSkill, removeSkill } from '../skill.js';
import { UsageError } from '../errors.js';

// Manage the bundled Claude skill (~/.claude/skills/cpm/SKILL.md). The skill is
// normally installed automatically by the npm postinstall hook; this command is
// the fallback for sandboxes/CI (where postinstall is skipped), for opting back
// in after CPM_NO_POSTINSTALL, and for removing it on its own.
export default async function skill(ctx) {
  const sub = ctx.args[0] || 'install';

  switch (sub) {
    case 'install': {
      const written = installSkill(ctx.paths);
      ctx.ui.success(`Installed Claude skill → ${written}`);
      ctx.ui.info('Tell Claude "set up cpm" to configure your profiles.');
      return 0;
    }
    case 'uninstall':
    case 'remove': {
      const removed = removeSkill(ctx.paths);
      if (removed) ctx.ui.success(`Removed ${ctx.paths.skillFile}`);
      else ctx.ui.info('No skill installed — nothing to remove.');
      return 0;
    }
    case 'path':
      ctx.ui.print(ctx.paths.skillFile);
      return 0;
    default:
      throw new UsageError(
        `Unknown subcommand "${sub}". Usage: cpm skill <install|uninstall|path>`,
      );
  }
}
