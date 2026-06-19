import { parseJsonc } from './jsonc.js';
import { ConfigError, ProfileNotFoundError } from './errors.js';

// Parse + validate the profiles config from JSONC text.
export function readConfig(text, { source = 'config' } = {}) {
  return normalizeConfig(parseJsonc(text, { source }), source);
}

// Validate the shape and fill defaults. Pure: operates on an already-parsed value.
export function normalizeConfig(data, source = 'config') {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ConfigError(`${source}: expected a JSON object at the top level`);
  }
  const { profiles } = data;
  if (profiles == null || typeof profiles !== 'object' || Array.isArray(profiles)) {
    throw new ConfigError(`${source}: missing "profiles" object`);
  }

  // Back-compat guard: catch the old top-level array `base` and any stray
  // `mcpBase` before structural validation, so the message is actionable.
  if (Array.isArray(data.base) || data.mcpBase !== undefined) {
    throw new ConfigError(
      `${source}: config uses the old "base"/"mcpBase" format. ` +
        `"base" is now a nested object: ` +
        `{ "base": { "plugins": [...], "mcp": [...] } } (remove the top-level "mcpBase"). ` +
        'See `cpm help` for the current shape.',
    );
  }

  const base = data.base ?? {};
  if (base == null || typeof base !== 'object' || Array.isArray(base)) {
    throw new ConfigError(`${source}: "base" must be an object`);
  }

  const basePlugins = base.plugins ?? [];
  if (!Array.isArray(basePlugins)) {
    throw new ConfigError(`${source}: "base.plugins" must be an array of plugin ids`);
  }

  const baseMcp = base.mcp ?? [];
  if (!Array.isArray(baseMcp)) {
    throw new ConfigError(`${source}: "base.mcp" must be an array of MCP server names`);
  }

  for (const [name, p] of Object.entries(profiles)) {
    if (p == null || typeof p !== 'object' || Array.isArray(p)) {
      throw new ConfigError(`${source}: profile "${name}" must be an object`);
    }
    if (p.plugins != null && !Array.isArray(p.plugins)) {
      throw new ConfigError(`${source}: profile "${name}".plugins must be an array`);
    }
    if (p.mcp != null && !Array.isArray(p.mcp)) {
      throw new ConfigError(`${source}: profile "${name}".mcp must be an array`);
    }
    if (
      p.extends != null &&
      typeof p.extends !== 'string' &&
      !Array.isArray(p.extends)
    ) {
      throw new ConfigError(`${source}: profile "${name}".extends must be a string or array`);
    }
    if (
      p.extraArgs != null &&
      (!Array.isArray(p.extraArgs) || !p.extraArgs.every((e) => typeof e === 'string'))
    ) {
      throw new ConfigError(`${source}: profile "${name}".extraArgs must be an array of strings`);
    }
  }

  return {
    version: data.version ?? 1,
    base: { plugins: basePlugins, mcp: baseMcp },
    profiles,
  };
}

export function listProfileNames(config) {
  return Object.keys(config.profiles);
}

// Resolve a profile to its ordered, deduped list of *raw* plugin entries
// (still possibly bare names). Order: global base -> parents (in order) -> self.
// Bare->fully-qualified resolution happens later against the plugin universe.
export function resolveProfileEntries(config, name, _seen = []) {
  return resolveEntriesFor(
    config,
    name,
    { baseList: config.base.plugins, profileKey: 'plugins' },
    _seen,
  );
}

// MCP analogue of resolveProfileEntries: walks the same base -> extends -> self
// chain but over `base.mcp` and each profile's `mcp` array. A profile's
// `"base": false` opts out of `base.mcp` too (same coupling). Returns ordered,
// deduped *raw* MCP server names; existence is checked later against the universe.
export function resolveMcpEntries(config, name, _seen = []) {
  return resolveEntriesFor(
    config,
    name,
    { baseList: config.base.mcp, profileKey: 'mcp' },
    _seen,
  );
}

// Shared traversal for both axes. `baseList` is the global base to prepend when
// the profile doesn't opt out via `base: false`; `profileKey` is the profile's
// own entry array ("plugins" or "mcp").
function resolveEntriesFor(config, name, { baseList, profileKey }, _seen = []) {
  const profile = config.profiles[name];
  if (!profile) {
    const avail = listProfileNames(config).join(', ') || '(none)';
    throw new ProfileNotFoundError(`Unknown profile "${name}". Available: ${avail}`);
  }
  if (_seen.includes(name)) {
    throw new ConfigError(`Circular extends: ${[..._seen, name].join(' -> ')}`);
  }
  const seen = [..._seen, name];

  const out = [];
  if (profile.base !== false) out.push(...baseList);

  const parents =
    profile.extends == null
      ? []
      : Array.isArray(profile.extends)
        ? profile.extends
        : [profile.extends];
  for (const parent of parents) {
    out.push(...resolveEntriesFor(config, parent, { baseList, profileKey }, seen));
  }

  out.push(...(profile[profileKey] ?? []));
  return dedupeFirst(out);
}

function dedupeFirst(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}
