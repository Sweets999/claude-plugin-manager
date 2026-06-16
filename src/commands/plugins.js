import { loadPluginState } from '../discover.js';
import { renderPluginList } from '../render.js';

export default async function plugins(ctx) {
  const { universe, enabledPlugins, list } = loadPluginState(ctx);

  const rows = list
    ? list.map((p) => ({
        id: p.id,
        enabled: p.enabled === true || enabledPlugins[p.id] === true,
      }))
    : [...universe].map((id) => ({ id, enabled: enabledPlugins[id] === true }));

  // The CLI can list a plugin once per scope; collapse to one row per id.
  const byId = new Map();
  for (const r of rows) {
    const prev = byId.get(r.id);
    byId.set(r.id, prev ? { ...prev, enabled: prev.enabled || r.enabled } : r);
  }
  const merged = [...byId.values()];

  if (ctx.ui.json) {
    ctx.ui.data({ plugins: merged });
    return 0;
  }
  ctx.ui.print(renderPluginList(ctx.ui, merged));
  const on = merged.filter((r) => r.enabled).length;
  ctx.ui.info(ctx.ui.c.dim(`\n${on}/${merged.length} enabled`));
  return 0;
}
