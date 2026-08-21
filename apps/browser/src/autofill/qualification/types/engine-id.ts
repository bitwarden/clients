/**
 * Stable selection keys for the qualification engines. These values are
 * persisted in the `autofill-qualification-engine` feature flag and in the
 * `qualificationEngine` dev flag, so renaming one is a breaking change to
 * anything already holding the old string.
 */
export const QualificationEngineId = Object.freeze({
  Legacy: "legacy",
  Scoring: "scoring",
  Autocomplete: "autocomplete",
} as const);
export type QualificationEngineId =
  (typeof QualificationEngineId)[keyof typeof QualificationEngineId];

const ALL_IDS: ReadonlySet<string> = new Set(Object.values(QualificationEngineId));

export function isQualificationEngineId(value: unknown): value is QualificationEngineId {
  return typeof value === "string" && ALL_IDS.has(value);
}

/**
 * Narrows an untrusted value to a QualificationEngineId, or returns undefined.
 *
 * Both selection sources are untrusted. Feature flag values arrive from the
 * server and `getFeatureFlagValue` casts them without any runtime check, and
 * dev flag values are hand-typed into a local config file. A bad value must
 * degrade to the default engine, never throw.
 */
export function toQualificationEngineId(value: unknown): QualificationEngineId | undefined {
  return isQualificationEngineId(value) ? value : undefined;
}
