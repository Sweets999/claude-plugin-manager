// Terminal output helper. Color is opt-out via --no-color or NO_COLOR.
// `quiet` suppresses info/success chatter (warnings + errors always show).

const CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

export function createUi({
  color = true,
  quiet = false,
  json = false,
  out = process.stdout,
  err = process.stderr,
} = {}) {
  const enabled = color && !process.env.NO_COLOR && Boolean(out.isTTY);
  const paint = (code, s) => (enabled ? `${code}${s}${CODES.reset}` : String(s));

  const c = {
    bold: (s) => paint(CODES.bold, s),
    dim: (s) => paint(CODES.dim, s),
    red: (s) => paint(CODES.red, s),
    green: (s) => paint(CODES.green, s),
    yellow: (s) => paint(CODES.yellow, s),
    cyan: (s) => paint(CODES.cyan, s),
  };

  const write = (stream, s) => stream.write(s + '\n');

  return {
    json,
    c,
    print: (s = '') => write(out, s),
    info: (s) => {
      if (!quiet) write(out, s);
    },
    success: (s) => {
      if (!quiet) write(out, `${c.green('✓')} ${s}`);
    },
    warn: (s) => write(err, `${c.yellow('warning:')} ${s}`),
    error: (s) => write(err, `${c.red('error:')} ${s}`),
    // Emit a machine-readable payload (used by read commands under --json).
    data: (obj) => write(out, JSON.stringify(obj, null, 2)),
  };
}
