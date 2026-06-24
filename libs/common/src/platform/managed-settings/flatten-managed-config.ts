/** Maximum object-nesting depth traversed before a subtree is emitted as one leaf. */
export const MAX_FLATTEN_DEPTH = 10;
/** Maximum number of leaves emitted; further keys are dropped. */
export const MAX_FLATTEN_KEYS = 1000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Flattens an OS managed-config object into the canonical profile shape: a flat
 * map of dotted keys to JSON-encoded values. Plain (non-array) objects are
 * traversed; every other value — primitive, array, or null — is a JSON-encoded
 * leaf. The dev source and every platform reader use this so they emit
 * identical keys.
 *
 * The source is admin-controlled, so depth and output size are bounded: nesting
 * past MAX_FLATTEN_DEPTH is emitted as a single JSON leaf instead of recursed,
 * and keys past MAX_FLATTEN_KEYS are dropped. Over-limit input is truncated, not
 * thrown, so a pathological or accidentally huge managed policy cannot stall boot
 * (mirrors swallowing acquisition read failures).
 */
export function flattenManagedConfig(raw: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>();

  const visit = (value: unknown, prefix: string, depth: number): void => {
    if (out.size >= MAX_FLATTEN_KEYS) {
      return;
    }
    if (depth < MAX_FLATTEN_DEPTH && isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        visit(child, prefix === "" ? key : `${prefix}.${key}`, depth + 1);
      }
      return;
    }
    out.set(prefix, JSON.stringify(value));
  };

  visit(raw, "", 0);
  return out;
}
