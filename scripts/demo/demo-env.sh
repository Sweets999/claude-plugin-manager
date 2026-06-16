# Sourced by the VHS demo tapes (and handy for manual practice runs).
# Rebuilds the hermetic sandbox, points cpm at it, and makes `cpm` resolve to the
# local checkout — so recordings show a clean `cpm …` with only fictional plugins.
#
#   source scripts/demo/demo-env.sh

# Resolve the repo root from this script's location (works when sourced).
_DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
_REPO="$(cd "$_DEMO_DIR/../.." && pwd)"

# Fresh sandbox every time -> deterministic, re-recordable demos.
SANDBOX="$(node "$_DEMO_DIR/setup.mjs")"

export CPM_HOME="$SANDBOX"
export CPM_CLAUDE_JSON="$SANDBOX/.claude.json"
export CPM_CLAUDE_BIN="$_DEMO_DIR/fake-claude"
export CPM_DEMO_PLUGINS_JSON="$SANDBOX/plugins-list.json"
export CPM_DEMO_MCP_LIST="$SANDBOX/mcp-list.txt"

# Show `cpm` in the recording, run the local checkout under the hood.
cpm() { node "$_REPO/bin/cpm.js" "$@"; }

# Tidy, distraction-free prompt.
export PS1='❯ '
clear
