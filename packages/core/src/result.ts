/**
 * Validation results and errors.
 *
 * Codes are lowercase snake_case and stable; messages are for humans and are
 * never parsed (BitBlocks convention D4).
 */

export interface Issue {
  code: string;
  /** Where the problem is, e.g. `tags.r`, `worlds.example-museum.entry.url`. */
  path: string;
  message: string;
}

export type Result<T> =
  | { ok: true; value: T; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] };

export class NswpError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, opts: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = "NswpError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    if (opts.details) this.details = opts.details;
  }
}

/** Collects errors and warnings while a validator walks its input. */
export class Collector {
  readonly errors: Issue[] = [];
  readonly warnings: Issue[] = [];
  error(code: string, path: string, message: string): void {
    this.errors.push({ code, path, message });
  }
  warn(code: string, path: string, message: string): void {
    this.warnings.push({ code, path, message });
  }
  result<T>(value: T): Result<T> {
    return this.errors.length > 0
      ? { ok: false, errors: this.errors, warnings: this.warnings }
      : { ok: true, value, warnings: this.warnings };
  }
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
