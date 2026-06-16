import { loadConfig, loadPluginState, loadMcpState, detectProjectOverride } from '../discover.js';
import { resolveProfileEntries, resolveMcpEntries } from '../config.js';
import { resolveEntries } from '../plugins.js';
import { resolveMcpNames } from '../mcp.js';
import { enabledList } from '../planner.js';

export default async function status(ctx) {
  const { universe, enabledPlugins } = loadPluginState(ctx);
  const curOn = enabledList(enabledPlugins);
  const curSet = new Set(curOn);

  const { live, universe: mcpUniverse } = loadMcpState(ctx);
  const curMcp = Object.keys(live).sort();
  const curMcpSet = new Set(curMcp);

  let config = null;
  try {
    config = loadConfig(ctx);
  } catch {
    /* no config yet */
  }

  const matches = [];
  if (config) {
    for (const name of Object.keys(config.profiles)) {
      try {
        const onSet = new Set(resolveEntries(resolveProfileEntries(config, name), universe).resolved);
        if (!setsEqual(onSet, curSet)) continue;
        const mcpSet = new Set(
          resolveMcpNames(resolveMcpEntries(config, name), mcpUniverse).resolved,
        );
        if (setsEqual(mcpSet, curMcpSet)) matches.push(name);
      } catch {
        /* skip broken profile */
      }
    }
  }

  const overrides = detectProjectOverride(ctx);

  if (ctx.ui.json) {
    ctx.ui.data({
      enabled: curOn,
      count: curOn.length,
      matches,
      projectOverrides: overrides,
      mcp: { enabled: curMcp },
    });
    return 0;
  }

  const { c } = ctx.ui;
  const head = matches.length
    ? c.dim('  matches profile: ') + c.green(matches.join(', '))
    : c.dim('  (no matching profile)');
  ctx.ui.print(c.bold(`${curOn.length} plugin${curOn.length === 1 ? '' : 's'} enabled`) + head);
  if (curOn.length === 0) ctx.ui.print('  ' + c.dim('(none)'));
  for (const id of curOn) ctx.ui.print('  ' + c.green('●') + ' ' + id);

  ctx.ui.print('');
  ctx.ui.print(c.bold(`${curMcp.length} MCP server${curMcp.length === 1 ? '' : 's'} enabled`));
  if (curMcp.length === 0) ctx.ui.print('  ' + c.dim('(none)'));
  for (const name of curMcp) ctx.ui.print('  ' + c.green('●') + ' ' + name);
  ctx.ui.print('  ' + c.dim('(plugin-provided MCP servers are always on and not managed by cpm)'));

  if (!config) ctx.ui.info('\n' + c.dim('No profiles config yet — run `cpm init`.'));
  else if (!matches.length) ctx.ui.info('\n' + c.dim('Save this set as a profile: `cpm save <name>`'));

  for (const f of overrides) {
    ctx.ui.warn(
      `${f} defines enabledPlugins and overrides ~/.claude here — ` +
        '`cpm use` has no effect in this directory; use `cpm run` instead.',
    );
  }
  return 0;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
