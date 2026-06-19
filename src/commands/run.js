import { loadConfig, planProfile, planMcpProfile } from '../discover.js';
import { runWithProfile } from '../runner.js';
import { UsageError } from '../errors.js';

export default async function run(ctx) {
  const name = ctx.args[0];
  if (!name) throw new UsageError('usage: cpm run <profile> [-- <claude args>]');

  const config = loadConfig(ctx);
  const pluginPlan = planProfile(ctx, config, name, { strict: false });
  const mcpPlan = planMcpProfile(ctx, config, name, { strict: false });

  for (const u of pluginPlan.unknown) ctx.ui.warn(`profile references uninstalled plugin: ${u}`);
  for (const u of mcpPlan.unknown) ctx.ui.warn(`profile references unknown MCP server: ${u}`);

  ctx.ui.info(
    ctx.ui.c.dim(
      `cpm: launching claude with profile "${name}" ` +
        `(${pluginPlan.resolved.length} plugins, ${mcpPlan.selected.length} MCP, isolated session)`,
    ),
  );

  const profileExtraArgs = config.profiles[name]?.extraArgs ?? [];
  const allPassthrough = [...profileExtraArgs, ...ctx.passthrough];

  // Non-mutating: defs for selected-but-disabled servers come from mcpPlan.desired
  // (resolved against the merged store ∪ live), so nothing on disk is touched.
  return runWithProfile(ctx, pluginPlan.desired, allPassthrough, { mcpServers: mcpPlan.desired });
}
