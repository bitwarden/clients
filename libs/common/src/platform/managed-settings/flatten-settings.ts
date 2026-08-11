// Stand-in for PM-27720 (Managed Settings). Replace with the SDK's own flattening/resolution
// once `@bitwarden/sdk-internal` exports a `ManagementProfile` client.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flattenInto(source: Record<string, unknown>, prefix: string, target: Map<string, string>) {
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      flattenInto(value, path, target);
      continue;
    }
    const encoded = JSON.stringify(value);
    if (encoded !== undefined) {
      target.set(path, encoded);
    }
  }
}

/**
 * Turns a nested settings object into the dotted-key, JSON-encoded-leaf form that
 * `ManagementProfile.settings` holds.
 */
export function flattenSettings(source: Record<string, unknown>): Map<string, string> {
  const target = new Map<string, string>();
  flattenInto(source, "", target);
  return target;
}
