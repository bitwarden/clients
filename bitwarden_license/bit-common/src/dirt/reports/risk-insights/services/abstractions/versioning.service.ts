/**
 * A versioned envelope that wraps any encrypted blob payload.
 *
 * Separates envelope metadata (version) from payload content (data), so that:
 * - Validators only receive payload data — never envelope metadata
 * - Version routing is handled before payload validation
 * - Legacy (unversioned) blobs are detected by the absence of this envelope shape
 *
 * @example
 * // On-disk format:
 * { "version": 1, "data": { "reports": [...], "memberRegistry": {...} } }
 *
 * // Detection:
 * if (isVersionEnvelope(json)) { ... } // versioned
 * else { ... }                         // legacy (unversioned)
 */
export interface VersionEnvelope<T> {
  version: number;
  data: T;
}

/**
 * Returns true if `value` matches the `VersionEnvelope` shape:
 * a plain object with a numeric `version` field and a `data` field.
 *
 * Returns false for legacy (unversioned) blobs — arrays, plain flat objects, null, etc.
 */
export function isVersionEnvelope(value: unknown): value is VersionEnvelope<unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj["version"] === "number" && "data" in obj;
}

/**
 * Thrown when an encrypted blob carries an unrecognized version number.
 *
 * Unversioned (legacy) blobs are transformed inline and do not throw this error.
 * This error is only thrown when a version number is present but not handled —
 * meaning the application may need to be updated.
 */
export class UnsupportedVersionError extends Error {
  constructor(readonly foundVersion: number | undefined) {
    super(
      foundVersion === undefined
        ? "Version not supported."
        : `Version ${foundVersion} is not supported. The application may need to be updated.`,
    );
    this.name = "UnsupportedVersionError";
  }
}

/**
 * Handles format versioning for a single encrypted blob type.
 *
 * Responsibilities:
 * - Detect versioned (`VersionEnvelope`) vs legacy (unversioned) format
 * - Validate and return the typed payload from an envelope
 * - Transform legacy blobs inline to the current payload shape
 * - Serialize a typed payload to a JSON string for encryption
 *
 * This service has no knowledge of encryption — it operates entirely on
 * parsed JSON (`unknown` → typed data) and serialized strings.
 *
 * @typeParam T - The typed payload this service processes and serializes.
 *
 * @example
 * class ReportVersioningService extends VersioningService<AccessReportPayload> {
 *   readonly currentVersion = 1;
 *   process(json: unknown): { data: AccessReportPayload; wasLegacy: boolean } { ... }
 *   serialize(data: AccessReportPayload): string { ... }
 * }
 */
export abstract class VersioningService<T> {
  /**
   * The version number written into newly serialized envelopes.
   * Used by `process()` to validate incoming versioned blobs.
   */
  abstract readonly currentVersion: number;

  /**
   * Parses and validates a decrypted blob, transforming legacy format if needed.
   *
   * - If `json` is a `VersionEnvelope` at `currentVersion`: validates and returns the inner payload.
   * - If `json` is a legacy (unversioned) blob: transforms inline to the current payload shape.
   * - If `json` is a `VersionEnvelope` at an unknown version: throws `UnsupportedVersionError`.
   *
   * @param json - The result of `JSON.parse()` on the decrypted blob string.
   * @returns The typed payload and whether the input was in legacy format.
   * @throws `UnsupportedVersionError` if the envelope version is unrecognized.
   * @throws `Error` if the data fails payload validation.
   */
  abstract process(json: unknown): { data: T; wasLegacy: boolean };

  /**
   * Serializes a typed payload to a JSON string for encryption.
   * Wraps the payload in a `VersionEnvelope` at `currentVersion`.
   *
   * @param data - The typed payload to serialize.
   * @returns A JSON string representing `{ version: currentVersion, data }`.
   */
  abstract serialize(data: T): string;
}
