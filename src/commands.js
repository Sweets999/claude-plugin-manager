// Single source of truth for the command set. `cli.js` derives KNOWN_COMMANDS
// from this, and `bin/cpm.js` derives both help texts and alias resolution from
// it. Adding or renaming a command = one entry here + a `src/commands/<name>.js`
// file (builtins like `help` are dispatched in bin/cpm.js and have no file).
export const COMMANDS = [
  {
    name: 'use',
    aliases: [],
    group: 'apply',
    usage: 'use <profile>',
    summary: 'Persistently swap the global profile',
    flags: ['-n/--dry-run', '-y/--yes', '--strict'],
  },
  {
    name: 'run',
    aliases: [],
    group: 'apply',
    usage: 'run <profile> [-- <claude args>]',
    summary: 'Launch claude with only this profile for one session',
    flags: ['--strict'],
  },
  {
    name: 'ls',
    aliases: ['list'],
    group: 'read',
    usage: 'ls',
    summary: 'List defined profiles',
    flags: ['--json'],
  },
  {
    name: 'status',
    aliases: [],
    group: 'read',
    usage: 'status',
    summary: 'Show the current enabled set + matching profile',
    flags: ['--json'],
  },
  {
    name: 'plugins',
    aliases: [],
    group: 'read',
    usage: 'plugins',
    summary: 'List installed plugins and their enabled state',
    flags: ['--json'],
  },
  {
    name: 'mcp',
    aliases: [],
    group: 'read',
    usage: 'mcp',
    summary: 'List MCP servers (managed vs. plugin-provided)',
    flags: ['--json'],
  },
  {
    name: 'diff',
    aliases: [],
    group: 'read',
    usage: 'diff <profile>',
    summary: 'Preview what `use` would change',
    flags: ['--json'],
  },
  {
    name: 'save',
    aliases: [],
    group: 'manage',
    usage: 'save <name>',
    summary: 'Save the current enabled set as a profile',
    flags: ['--force'],
  },
  {
    name: 'edit',
    aliases: [],
    group: 'manage',
    usage: 'edit',
    summary: 'Open the profiles config in $EDITOR',
    flags: [],
  },
  {
    name: 'undo',
    aliases: [],
    group: 'manage',
    usage: 'undo',
    summary: 'Revert the last `use`',
    flags: [],
  },
  {
    name: 'init',
    aliases: [],
    group: 'manage',
    usage: 'init',
    summary: 'Create a starter profiles config',
    flags: ['--force'],
  },
  {
    name: 'uninstall',
    aliases: [],
    group: 'manage',
    usage: 'uninstall',
    summary: 'Remove all cpm files from ~/.claude',
    flags: ['-n/--dry-run', '-y/--yes', '--purge', '--keep-config'],
  },
  {
    name: 'help',
    aliases: [],
    group: 'meta',
    usage: 'help',
    summary: 'Full setup + usage guide (ideal to hand to an AI agent)',
    flags: [],
    builtin: true,
  },
];

// Every verb the parser recognises (canonical names + aliases). `version` is a
// flag-driven builtin (`--version`/`-V`) but is also accepted as a bare verb.
export const KNOWN_COMMANDS = new Set([
  ...COMMANDS.flatMap((c) => [c.name, ...c.aliases]),
  'version',
]);

// alias -> canonical name (e.g. `list` -> `ls`).
export const ALIAS_TO_NAME = new Map(
  COMMANDS.flatMap((c) => c.aliases.map((a) => [a, c.name])),
);
