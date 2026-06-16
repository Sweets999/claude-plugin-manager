// Typed errors carrying the process exit code cpm should terminate with.
// Exit codes: 0 ok · 1 runtime · 2 usage · 3 profile not found ·
//             4 validation/resolution failure · 5 config/settings malformed.

export class CpmError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'CpmError';
    this.exitCode = exitCode;
    this.isCpm = true;
  }
}

export class UsageError extends CpmError {
  constructor(message) {
    super(message, 2);
    this.name = 'UsageError';
  }
}

export class ProfileNotFoundError extends CpmError {
  constructor(message) {
    super(message, 3);
    this.name = 'ProfileNotFoundError';
  }
}

export class StrictValidationError extends CpmError {
  constructor(message) {
    super(message, 4);
    this.name = 'StrictValidationError';
  }
}

export class AmbiguousPluginError extends CpmError {
  constructor(message) {
    super(message, 4);
    this.name = 'AmbiguousPluginError';
  }
}

export class ConfigError extends CpmError {
  constructor(message) {
    super(message, 5);
    this.name = 'ConfigError';
  }
}

export class SettingsError extends CpmError {
  constructor(message) {
    super(message, 5);
    this.name = 'SettingsError';
  }
}
