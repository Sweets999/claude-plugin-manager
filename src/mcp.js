// MCP analogue of plugins.js. User-defined MCP servers are unique keys in the
// `mcpServers` map (no "name@marketplace" concept), so there is no ambiguity:
// a profile entry either names a known server or it doesn't. Plugin-bundled MCPs
// live elsewhere and are never managed here.

// Build the full set of manageable user MCP server names: every name known to
// the side-store unioned with every name live in ~/.claude.json. Plugin MCPs
// never appear here.
export function getMcpUniverse({ storeServers = {}, liveServers = {} } = {}) {
  const names = new Set();
  for (const k of Object.keys(storeServers)) names.add(k);
  for (const k of Object.keys(liveServers)) names.add(k);
  return names;
}

// Merge the side-store of MCP server definitions with the live ones. Live wins
// on name conflicts (live defs are fresher). Inputs are not mutated.
export function mergeStore(storeServers = {}, liveServers = {}) {
  return { ...storeServers, ...liveServers };
}

// Map raw profile entries (bare MCP server names) against the universe.
// - known name: kept (deduped, first-seen order).
// - unknown name: reported (deduped). `universe` is a Set.
export function resolveMcpNames(entries, universe) {
  const resolved = [];
  const unknown = [];
  const seenResolved = new Set();
  const seenUnknown = new Set();

  for (const entry of entries) {
    if (universe.has(entry)) {
      if (!seenResolved.has(entry)) {
        seenResolved.add(entry);
        resolved.push(entry);
      }
    } else if (!seenUnknown.has(entry)) {
      seenUnknown.add(entry);
      unknown.push(entry);
    }
  }

  return { resolved, unknown };
}
