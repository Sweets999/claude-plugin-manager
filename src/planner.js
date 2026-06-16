// Pure planning logic: turn a resolved plugin list into the desired
// enabledPlugins map, and diff it against the current one.

// Exclusive set: every known plugin off, then the profile's plugins on.
// The "known" universe is unioned with the current map's keys (so plugins
// already referenced in settings get an explicit `false`) and with the
// profile list (so a listed-but-not-yet-installed plugin is still enabled).
export function computeExclusiveSet(fqList, universe, currentEnabled = {}) {
  const allKeys = new Set([
    ...universe,
    ...Object.keys(currentEnabled),
    ...fqList,
  ]);
  const desired = {};
  for (const id of [...allKeys].sort()) desired[id] = false;
  for (const id of fqList) desired[id] = true;
  return desired;
}

// Compare current vs desired enabledPlugins (true === enabled).
export function diff(currentEnabled = {}, desired = {}) {
  const enable = [];
  const disable = [];
  const unchanged = [];
  const keys = new Set([...Object.keys(currentEnabled), ...Object.keys(desired)]);
  for (const id of [...keys].sort()) {
    const was = currentEnabled[id] === true;
    const will = desired[id] === true;
    if (was === will) unchanged.push(id);
    else if (will) enable.push(id);
    else disable.push(id);
  }
  return { enable, disable, unchanged };
}

// Sorted ids that are currently enabled.
export function enabledList(enabledPlugins = {}) {
  return Object.keys(enabledPlugins)
    .filter((k) => enabledPlugins[k] === true)
    .sort();
}

// Desired MCP server map for a profile: each selected name that exists in the
// store, mapped to its definition. Names not in the store are skipped (already
// reported as unknown upstream). Insertion order follows `selectedNames`.
export function computeMcpDesired(selectedNames, storeServers = {}) {
  const desired = {};
  for (const name of selectedNames) {
    if (Object.prototype.hasOwnProperty.call(storeServers, name)) {
      desired[name] = storeServers[name];
    }
  }
  return desired;
}

// Diff current vs desired MCP servers by presence, returning name arrays.
// Reuses diff() over presence maps so sorting/semantics match the plugin path.
export function diffMcp(currentServers = {}, desiredServers = {}) {
  const toPresence = (obj) => {
    const m = {};
    for (const k of Object.keys(obj)) m[k] = true;
    return m;
  };
  return diff(toPresence(currentServers), toPresence(desiredServers));
}
