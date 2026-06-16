import readline from 'node:readline';

// Yes/no prompt on the controlling terminal. In a non-interactive context
// (piped/CI), returns false so callers fall back to requiring -y/--yes.
export function confirm(question, { defaultYes = false } = {}) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  return new Promise((resolve) => {
    rl.question(question + suffix, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else resolve(a === 'y' || a === 'yes');
    });
  });
}
