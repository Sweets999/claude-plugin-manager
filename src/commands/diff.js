import { loadConfig, planProfile, planMcpProfile } from '../discover.js';
import { renderPlan, renderMcpPlan } from '../render.js';
import { UsageError } from '../errors.js';

export default async function diff(ctx) {
  const name = ctx.args[0];
  if (!name) throw new UsageError('usage: cpm diff <profile>');

  const config = loadConfig(ctx);
  const pluginPlan = planProfile(ctx, config, name, { strict: !!ctx.flags.strict });
  const mcpPlan = planMcpProfile(ctx, config, name, { strict: !!ctx.flags.strict });

  if (ctx.ui.json) {
    ctx.ui.data({
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
    });
    return 0;
  }

  ctx.ui.print(renderPlan(ctx.ui, name, pluginPlan));
  ctx.ui.print(renderMcpPlan(ctx.ui, mcpPlan));
  for (const u of pluginPlan.unknown) ctx.ui.warn(`profile references uninstalled plugin: ${u}`);
  for (const u of mcpPlan.unknown) ctx.ui.warn(`profile references unknown MCP server: ${u}`);
  return 0;
}
