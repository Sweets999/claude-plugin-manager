import { loadMcpState, getMcpListText, parsePluginMcpNames } from '../discover.js';
import { renderMcpList } from '../render.js';

export default async function mcp(ctx) {
  const { live, universe } = loadMcpState(ctx);

  const userRows = [...universe].sort().map((name) => ({
    name,
    enabled: Object.prototype.hasOwnProperty.call(live, name),
    source: 'user',
  }));

  // Best-effort discovery of plugin-bundled MCP servers (cosmetic only).
  const txt = getMcpListText(ctx);
  const pluginNames = txt ? parsePluginMcpNames(txt) : [];
  const pluginRows = pluginNames.map((name) => ({ name, enabled: true, source: 'plugin' }));

  if (ctx.ui.json) {
    ctx.ui.data({ servers: [...userRows, ...pluginRows] });
    return 0;
  }

  ctx.ui.print(renderMcpList(ctx.ui, [...userRows, ...pluginRows]));
  const on = userRows.filter((r) => r.enabled).length;
  ctx.ui.info(ctx.ui.c.dim(`\n${on}/${userRows.length} enabled`));
  return 0;
}
