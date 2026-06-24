function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Flattens an OS managed-config object into the canonical profile shape: a flat
 * map of dotted keys to JSON-encoded values. Plain (non-array) objects are
 * traversed; every other value — primitive, array, or null — is a JSON-encoded
 * leaf. The dev source and every platform reader use this so they emit
 * identical keys.
 */
export function flattenManagedConfig(raw: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>();

  const visit = (value: unknown, prefix: string): void => {
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        visit(child, prefix === "" ? key : `${prefix}.${key}`);
      }
      return;
    }
    out.set(prefix, JSON.stringify(value));
  };

  visit(raw, "");
  return out;
}
