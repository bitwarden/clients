import { MANAGED_KEY_CATALOG, ManagedKeyType } from "./catalog";

/** Maximum object-nesting depth traversed before a subtree is emitted as one leaf. */
export const MAX_FLATTEN_DEPTH = 10;
/** Maximum number of leaves emitted; further keys are dropped. */
export const MAX_FLATTEN_KEYS = 1000;

/** Lookup from dotted key to its catalog-declared type, built once at module load. */
const catalogTypes: Map<string, ManagedKeyType> = new Map(
  MANAGED_KEY_CATALOG.map((d) => [d.key, d.type]),
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerces a string leaf to the catalog-declared native type so that Windows
 * registry REG_SZ and macOS plist <string> values (e.g. "true", "2") are
 * stored as the correct JSON-encoded type rather than a double-quoted string.
 * Already-typed values (browser / Linux) are returned unchanged.
 */
function coerceLeaf(value: unknown, type: ManagedKeyType | undefined): unknown {
  if (typeof value !== "string") {
    return value;
  }
  if (type === "boolean") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return value;
  }
  if (type === "integer" && /^-?(?:0|[1-9]\d*)$/.test(value.trim())) {
    return Number(value);
  }
  return value;
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
    out.set(prefix, JSON.stringify(coerceLeaf(value, catalogTypes.get(prefix))));
  };

  visit(raw, "", 0);
  return out;
}
