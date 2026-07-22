/**
 * Flattens a nested settings object into the dotted-key, JSON-encoded-leaf form stored in a
 * {@link ManagementProfile}. For example `{ environment: { base: "https://vault" } }` becomes the
 * single entry `environment.base` -> `"\"https://vault\""`. Arrays and primitives are treated as
 * leaves and JSON-encoded whole; only plain objects are descended into.
 */
export function flattenSettings(source: Record<string, unknown>): Map<string, string> {
  const settings = new Map<string, string>();

  const walk = (prefix: string, value: unknown): void => {
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        walk(prefix === "" ? key : `${prefix}.${key}`, child);
      }
      return;
    }

    settings.set(prefix, JSON.stringify(value));
  };

  walk("", source);
  return settings;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
