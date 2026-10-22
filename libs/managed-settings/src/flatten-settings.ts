/**
 * Flattens a nested settings object into the dotted-key, JSON-encoded-leaf form stored in a
 * {@link ManagementProfile}. For example `{ environment: { base: "https://vault" } }` becomes the
 * single entry `environment.base` -> `"\"https://vault\""`. Arrays and primitives are treated as
 * leaves and JSON-encoded whole; only plain objects are descended into.
 *
 * A source key that already contains a `.` is emitted verbatim, so `{ "a.b": 1 }` and
 * `{ a: { b: 1 } }` collapse to one key. No escape syntax is defined, because every consumer and
 * the SDK would have to mirror it and no Bitwarden key has a dot inside a segment.
 *
 * Total by design: no input shape throws, so a client's boot-path acquisition cannot fail here
 */
export function flattenSettings(source: Record<string, unknown>): Map<string, string> {
  const settings = new Map<string, string>();
  visit(source, "", settings);
  return settings;
}

function visit(
  source: Record<string, unknown>,
  prefix: string,
  settings: Map<string, string>,
): void {
  // `Object.entries` skips inherited and symbol keys, so `__proto__` arrives as an ordinary key.
  for (const [key, value] of Object.entries(source)) {
    const dottedKey = prefix === "" ? key : `${prefix}.${key}`;

    if (isNamespace(value)) {
      visit(value, dottedKey, settings);
    } else if (value !== undefined) {
      // `JSON.stringify(undefined)` yields `undefined` rather than a string, which would break
      // `JSON.parse` for every consumer. Treat the key as absent instead.
      settings.set(dottedKey, JSON.stringify(value));
    }
  }
}

function isNamespace(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
