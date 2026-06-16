import { parse, modify, applyEdits, printParseErrorCode } from 'jsonc-parser';
import { ConfigError } from './errors.js';

// Parse JSONC (comments + trailing commas) into a plain JS value.
// Throws ConfigError with a line:col location on syntax errors.
export function parseJsonc(text, { source = 'config' } = {}) {
  const errors = [];
  const result = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0) {
    const e = errors[0];
    const { line, col } = offsetToLineCol(text, e.offset);
    throw new ConfigError(
      `Invalid JSONC in ${source} at ${line}:${col}: ${printParseErrorCode(e.error)}`,
    );
  }
  return result;
}

// Surgically set a value at `path` (e.g. ['profiles', 'name']) returning new
// text. Comments, key order and unrelated formatting are preserved.
export function editJsonc(text, path, value, { tabSize = 2 } = {}) {
  const edits = modify(text, path, value, {
    formattingOptions: { tabSize, insertSpaces: true, eol: '\n' },
  });
  return applyEdits(text, edits);
}

function offsetToLineCol(text, offset) {
  let line = 1;
  let col = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}
