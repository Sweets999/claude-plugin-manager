import { loadConfig, planProfile, planMcpProfile, detectProjectOverride } from '../discover.js';
import { applyProfile, writeMcpStore } from '../settings.js';
import { renderPlan, renderMcpPlan } from '../render.js';
import { confirm } from '../prompt.js';
import { UsageError } from '../errors.js';

export default async function use(ctx) {
  const name = ctx.args[0];
  if (!name) throw new UsageError('usage: cpm use <profile> [--dry-run] [--yes] [--strict]');

  const config = loadConfig(ctx);
  const pluginPlan = planProfile(ctx, config, name, { strict: !!ctx.flags.strict });
  const mcpPlan = planMcpProfile(ctx, config, name, { strict: !!ctx.flags.strict });

  const noPluginChanges =
    pluginPlan.changes.enable.length === 0 && pluginPlan.changes.disable.length === 0;
  const noMcpChanges =
    mcpPlan.changes.enable.length === 0 && mcpPlan.changes.disable.length === 0;

  if (!ctx.ui.json) {
    ctx.ui.print(renderPlan(ctx.ui, name, pluginPlan));
    ctx.ui.print(renderMcpPlan(ctx.ui, mcpPlan));
    for (const u of pluginPlan.unknown) ctx.ui.warn(`profile references uninstalled plugin: ${u}`);
    for (const u of mcpPlan.unknown) ctx.ui.warn(`profile references unknown MCP server: ${u}`);
  }

  if (noPluginChanges && noMcpChanges) {
    ctx.ui.success(`Already on profile "${name}".`);
    return 0;
  }

  // Warn if a higher-precedence project settings file would shadow `cpm use`.
  for (const file of detectProjectOverride(ctx)) {
    ctx.ui.warn(`project file overrides enabledPlugins; \`cpm use\` may not take effect here: ${file}`);
  }

  if (ctx.flags['dry-run']) {
    ctx.ui.info('(dry run — nothing written)');
    if (ctx.ui.json) ctx.ui.data(jsonShape(name, pluginPlan, mcpPlan, { dryRun: true }));
    return 0;
  }

  if (!ctx.flags.yes) {
    const ok = await confirm('Apply this profile?');
    if (!ok) {
      ctx.ui.info('Aborted. (pass --yes to skip this prompt)');
      return 0;
    }
  }

  // Persist the store superset first so disabled defs survive the switch.
  writeMcpStore(ctx.paths.mcpStore, mcpPlan.merged);

  // One lock, one combined undo pointer covering both files.
  applyProfile(
    [
      {
        filePath: ctx.paths.settings,
        key: 'enabledPlugins',
        value: pluginPlan.desired,
        backupLabel: 'settings.json',
      },
      {
        filePath: ctx.paths.claudeJson,
        key: 'mcpServers',
        value: mcpPlan.desired,
        backupLabel: 'claude.json',
      },
    ],
    {
      lock: ctx.paths.lock,
      backupsDir: ctx.paths.backupsDir,
      lastPointer: ctx.paths.lastPointer,
      appliedProfile: name,
    },
  );

  if (ctx.ui.json) {
    ctx.ui.data(jsonShape(name, pluginPlan, mcpPlan));
    return 0;
  }

  const n = pluginPlan.resolved.length;
  const m = mcpPlan.selected.length;
  ctx.ui.success(
    `Switched to profile "${name}" (${n} plugin${n === 1 ? '' : 's'} on, ` +
      `${m} MCP server${m === 1 ? '' : 's'} on).`,
  );
  ctx.ui.info('Restart claude or run /reload-plugins to apply. Undo with `cpm undo`.');
  return 0;
}

function jsonShape(name, pluginPlan, mcpPlan, extra = {}) {
  return {
    profile: name,
    resolved: pluginPlan.resolved,
    unknown: pluginPlan.unknown,
    ...pluginPlan.changes,
    mcp: {
      selected: mcpPlan.selected,
      unknown: mcpPlan.unknown,
      enable: mcpPlan.changes.enable,
      disable: mcpPlan.changes.disable,
      unchanged: mcpPlan.changes.unchanged,
    },
    ...extra,
  };
}
