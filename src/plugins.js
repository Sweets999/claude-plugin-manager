import { AmbiguousPluginError } from './errors.js';

// The bare plugin name from a "name@marketplace" id.
export function pluginName(id) {
  const i = id.indexOf('@');
  return i === -1 ? id : id.slice(0, i);
}

// Build the full set of known plugin ids ("name@marketplace").
// Source priority: `claude plugin list --json` (authoritative, includes all
// scopes) -> installed_plugins.json keys. Always unioned with existing
// enabledPlugins keys so nothing referenced in settings is left dangling.
export function getUniverse({ claudeListJson, installedPluginsJson, enabledPlugins } = {}) {
  const ids = new Set();

  let fromCli = null;
  if (claudeListJson) {
    try {
      const parsed = JSON.parse(claudeListJson);
      if (Array.isArray(parsed)) fromCli = parsed;
      else if (parsed && Array.isArray(parsed.plugins)) fromCli = parsed.plugins;
    } catch {
      fromCli = null;
    }
  }

  if (fromCli) {
    for (const p of fromCli) {
      if (p && typeof p.id === 'string') ids.add(p.id);
    }
  } else if (installedPluginsJson) {
    try {
      const obj = JSON.parse(installedPluginsJson);
      const plugins = obj && obj.plugins ? obj.plugins : obj;
      if (plugins && typeof plugins === 'object' && !Array.isArray(plugins)) {
        for (const k of Object.keys(plugins)) ids.add(k);
      }
    } catch {
      /* ignore — fall through to enabledPlugins only */
    }
  }

  if (enabledPlugins && typeof enabledPlugins === 'object') {
    for (const k of Object.keys(enabledPlugins)) ids.add(k);
  }

  return ids;
}

// Map raw profile entries (bare or fully-qualified) to fully-qualified ids.
// - "name@marketplace": kept as-is (reported as unknown if not installed).
// - bare "name": resolved via the universe; 0 matches -> dropped + reported,
//   exactly 1 -> resolved, >1 -> hard error (always, even without --strict).
export function resolveEntries(entries, universe) {
  const resolved = [];
  const unknown = [];
  const seen = new Set();

  for (const entry of entries) {
    let id;
    if (entry.includes('@')) {
      id = entry;
      if (!universe.has(id)) unknown.push(id);
    } else {
      const matches = [...universe].filter((u) => pluginName(u) === entry);
      if (matches.length === 1) {
        id = matches[0];
      } else if (matches.length === 0) {
        unknown.push(entry);
        continue;
      } else {
        throw new AmbiguousPluginError(
          `Plugin "${entry}" is ambiguous — matches ${matches.join(', ')}. ` +
            'Use the full "name@marketplace" form in your config.',
        );
      }
    }
    if (!seen.has(id)) {
      seen.add(id);
      resolved.push(id);
    }
  }

  return { resolved, unknown };
}
