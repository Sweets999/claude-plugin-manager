import { UsageError } from './errors.js';
import { KNOWN_COMMANDS } from './commands.js';

// Short flag -> long flag aliases.
const SHORT = {
  n: 'dry-run',
  y: 'yes',
  h: 'help',
  V: 'version',
  q: 'quiet',
};

// Long flags that consume the following token as their value.
const VALUE_FLAGS = new Set(['config']);

// Recognised verbs come from the command registry. Anything else in the first
// position is treated as a bare profile name and routed to `run` (the safe,
// non-mutating default).
export { KNOWN_COMMANDS };

// Parse argv (already sliced past `node script`) into a normalised shape.
// Everything after a standalone `--` is captured verbatim as `passthrough`
// (forwarded to `claude` by `cpm run`).
export function parseArgs(argv) {
  let passthrough = [];
  let main = argv;
  const sep = argv.indexOf('--');
  if (sep !== -1) {
    main = argv.slice(0, sep);
    passthrough = argv.slice(sep + 1);
  }

  const positionals = [];
  const flags = {};

  for (let i = 0; i < main.length; i++) {
    const tok = main[i];
    if (tok.startsWith('--')) {
      let key = tok.slice(2);
      let val = true;
      const eq = key.indexOf('=');
      if (eq !== -1) {
        val = key.slice(eq + 1);
        key = key.slice(0, eq);
      } else if (VALUE_FLAGS.has(key)) {
        val = main[++i];
        if (val === undefined) throw new UsageError(`Flag --${key} requires a value`);
      }
      flags[key] = val;
    } else if (tok.length > 1 && tok[0] === '-') {
      for (const c of tok.slice(1)) {
        const long = SHORT[c];
        if (!long) throw new UsageError(`Unknown flag -${c}`);
        flags[long] = true;
      }
    } else {
      positionals.push(tok);
    }
  }

  let command;
  let args;
  if (positionals.length === 0) {
    // `--help`/`-h` is handled downstream (concise help); the `help` verb shows
    // the full guide. Bare `cpm` defaults to `status`.
    command = flags.version ? 'version' : 'status';
    args = [];
  } else if (KNOWN_COMMANDS.has(positionals[0])) {
    command = positionals[0];
    args = positionals.slice(1);
  } else {
    // bare profile name -> `cpm run <profile>`
    command = 'run';
    args = positionals;
  }

  return { command, args, flags, passthrough };
}
