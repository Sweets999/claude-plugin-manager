import { loadConfig, loadPluginState, loadMcpState } from '../discover.js';
import { resolveProfileEntries, resolveMcpEntries } from '../config.js';
import { resolveEntries } from '../plugins.js';
import { resolveMcpNames } from '../mcp.js';
import { enabledList } from '../planner.js';
import { renderProfiles } from '../render.js';

export default async function ls(ctx) {
  const config = loadConfig(ctx);
  const { universe, enabledPlugins } = loadPluginState(ctx);
  const { universe: mcpUniverse } = loadMcpState(ctx);
  const curOn = new Set(enabledList(enabledPlugins));

  const rows = Object.keys(config.profiles).map((name) => {
    const description = config.profiles[name].description ?? '';
    try {
      const resolved = resolveEntries(resolveProfileEntries(config, name), universe).resolved;
      const mcpCount = resolveMcpNames(resolveMcpEntries(config, name), mcpUniverse).resolved.length;
      return {
        name,
        description,
        count: resolved.length,
        mcpCount,
        active: setsEqual(new Set(resolved), curOn),
      };
    } catch (e) {
      return { name, description, count: 0, mcpCount: 0, active: false, error: e.message };
    }
  });

  if (ctx.ui.json) {
    ctx.ui.data({ profiles: rows });
    return 0;
  }
  ctx.ui.print(renderProfiles(ctx.ui, rows));
  return 0;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
