import { restore } from '../settings.js';

export default async function undo(ctx) {
  const res = restore(ctx.paths.settings, {
    backupsDir: ctx.paths.backupsDir,
    lastPointer: ctx.paths.lastPointer,
    lock: ctx.paths.lock,
  });
  ctx.ui.success(
    `Reverted${res.restoredProfile ? ` profile "${res.restoredProfile}"` : ''} — previous plugins and MCP servers restored.`,
  );
  ctx.ui.info('Restart claude or run /reload-plugins to apply.');
  return 0;
}
