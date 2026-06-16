import { pluginName } from './plugins.js';

// Render the result of planProfile() for `use`/`diff`.
export function renderPlan(ui, name, plan) {
  const { c } = ui;
  const lines = [];
  const onCount = plan.resolved.length;
  lines.push(c.bold(`Profile "${name}"`) + c.dim(` → ${onCount} plugin${onCount === 1 ? '' : 's'} on`));

  if (onCount === 0) {
    lines.push('  ' + c.dim('(no plugins enabled)'));
  } else {
    const newly = new Set(plan.changes.enable);
    for (const id of plan.resolved) {
      const mark = newly.has(id) ? c.green('+') : c.dim('•');
      lines.push(`  ${mark} ${id}`);
    }
  }

  const { enable, disable } = plan.changes;
  lines.push('');
  lines.push(
    c.dim('changes: ') +
      c.green(`+${enable.length} enable`) +
      c.dim(' · ') +
      c.red(`-${disable.length} disable`),
  );
  for (const id of disable) lines.push('  ' + c.red(`- ${id}`));
  return lines.join('\n');
}

export function renderProfiles(ui, rows) {
  const { c } = ui;
  if (rows.length === 0) return c.dim('No profiles defined. Run `cpm init`.');
  const width = Math.max(...rows.map((r) => r.name.length));
  return rows
    .map((r) => {
      const marker = r.active ? c.green('●') : ' ';
      const nm = r.name.padEnd(width);
      let counts = `${r.count} plugin${r.count === 1 ? '' : 's'}`;
      if (r.mcpCount !== undefined) counts += ` · ${r.mcpCount} mcp`;
      const meta = r.error
        ? c.red(`(error: ${r.error})`)
        : c.dim(counts) + (r.description ? '  ' + r.description : '');
      return `${marker} ${c.bold(nm)}  ${meta}`;
    })
    .join('\n');
}

// Render the result of an MCP plan for `use`/`diff` — parallel to renderPlan.
export function renderMcpPlan(ui, plan) {
  const { c } = ui;
  const lines = [];
  const onCount = plan.selected.length;
  lines.push(c.bold('MCP servers') + c.dim(` (${onCount})`));

  const { enable, disable } = plan.changes;
  const hasChanges = enable.length > 0 || disable.length > 0;

  if (onCount === 0 && !hasChanges) {
    lines.push('  ' + c.dim('(no MCP servers)'));
    if (plan.unknown.length) {
      lines.push('  ' + c.yellow(`unknown MCP server(s) (ignored): ${plan.unknown.join(', ')}`));
    }
    return lines.join('\n');
  }

  if (onCount === 0) {
    lines.push('  ' + c.dim('(no MCP servers)'));
  } else {
    const newly = new Set(enable);
    for (const name of plan.selected) {
      const mark = newly.has(name) ? c.green('+') : c.dim('•');
      lines.push(`  ${mark} ${name}`);
    }
  }

  lines.push('');
  lines.push(
    c.dim('changes: ') +
      c.green(`+${enable.length} enable`) +
      c.dim(' · ') +
      c.red(`-${disable.length} disable`),
  );
  for (const name of disable) lines.push('  ' + c.red(`- ${name}`));

  if (plan.unknown.length) {
    lines.push('  ' + c.yellow(`unknown MCP server(s) (ignored): ${plan.unknown.join(', ')}`));
  }
  return lines.join('\n');
}

// List MCP servers with enabled state — parallel to renderPluginList.
// rows: { name, enabled, source } where source is 'user' or 'plugin'.
export function renderMcpList(ui, rows) {
  const { c } = ui;
  if (rows.length === 0) return c.dim('No MCP servers configured.');
  const userRows = rows.filter((r) => r.source !== 'plugin');
  const pluginRows = rows.filter((r) => r.source === 'plugin');
  const out = [];
  for (const r of userRows.sort((a, b) => a.name.localeCompare(b.name))) {
    const dot = r.enabled ? c.green('●') : c.dim('○');
    out.push(`  ${dot} ${r.name}`);
  }
  if (pluginRows.length) {
    if (out.length) out.push('');
    out.push(c.dim('plugin-provided (always on, not managed by cpm):'));
    for (const r of pluginRows.sort((a, b) => a.name.localeCompare(b.name))) {
      out.push('  ' + c.dim(r.name));
    }
  }
  return out.join('\n');
}

// Group installed plugins by marketplace with enabled state.
export function renderPluginList(ui, rows) {
  const { c } = ui;
  if (rows.length === 0) return c.dim('No plugins installed.');
  const byMarket = new Map();
  for (const r of rows) {
    const market = r.id.includes('@') ? r.id.slice(r.id.indexOf('@') + 1) : '(none)';
    if (!byMarket.has(market)) byMarket.set(market, []);
    byMarket.get(market).push(r);
  }
  const out = [];
  for (const market of [...byMarket.keys()].sort()) {
    out.push(c.bold(market));
    for (const r of byMarket.get(market).sort((a, b) => a.id.localeCompare(b.id))) {
      const dot = r.enabled ? c.green('●') : c.dim('○');
      out.push(`  ${dot} ${pluginName(r.id)}`);
    }
  }
  return out.join('\n');
}
