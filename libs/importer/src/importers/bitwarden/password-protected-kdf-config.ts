import { RangeWithDefault } from "@bitwarden/common/platform/misc/range-with-default";
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";
import { BitwardenPasswordProtectedFileFormat } from "@bitwarden/vault-export-core";

/**
 * Floor for PBKDF2 iteration counts accepted on password-protected import files.
 *
 * Kept separate from {@link PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN} so raising the
 * prelogin minimum (e.g. PM-23253) does not break importing older exports that used
 * lower iteration counts.
 */
const PBKDF2_IMPORT_ITERATIONS_MIN = 5000;

/**
 * Floors for Argon2id parameters accepted on password-protected import files.
 *
 * Separate from the {@link Argon2KdfConfig} minimums for the same reason as
 * {@link PBKDF2_IMPORT_ITERATIONS_MIN}: raising the minimum a client will accept should not make
 * previously valid exports unimportable. There is no plan to raise the Argon2 minimums, so these
 * currently match the values clients enforce elsewhere.
 */
const ARGON2_IMPORT_ITERATIONS_MIN = 2;
const ARGON2_IMPORT_MEMORY_MIN = 16;
const ARGON2_IMPORT_PARALLELISM_MIN = 1;

/**
 * Iteration bounds accepted for a PBKDF2 import file.
 *
 * Wider than {@link PBKDF2KdfConfig.ITERATIONS} on the low end, because an export carries the
 * KDF configuration that was current when it was created and older clients allowed lower
 * iteration counts. The upper bound is the same one the settings UI enforces.
 */
const PBKDF2_IMPORT_ITERATIONS = new RangeWithDefault(
  PBKDF2_IMPORT_ITERATIONS_MIN,
  PBKDF2KdfConfig.ITERATIONS.max,
  PBKDF2KdfConfig.ITERATIONS.defaultValue,
);

/**
 * Parameter bounds accepted for an Argon2id import file.
 *
 * The upper bounds are the ones the settings UI enforces; the lower bounds are the import floors
 * above rather than {@link Argon2KdfConfig}'s minimums, so the two can move independently.
 */
const ARGON2_IMPORT_ITERATIONS = new RangeWithDefault(
  ARGON2_IMPORT_ITERATIONS_MIN,
  Argon2KdfConfig.ITERATIONS.max,
  Argon2KdfConfig.ITERATIONS.defaultValue,
);

const ARGON2_IMPORT_MEMORY = new RangeWithDefault(
  ARGON2_IMPORT_MEMORY_MIN,
  Argon2KdfConfig.MEMORY.max,
  Argon2KdfConfig.MEMORY.defaultValue,
);

const ARGON2_IMPORT_PARALLELISM = new RangeWithDefault(
  ARGON2_IMPORT_PARALLELISM_MIN,
  Argon2KdfConfig.PARALLELISM.max,
  Argon2KdfConfig.PARALLELISM.defaultValue,
);

/**
 * Builds the KDF configuration for a password-protected export, rejecting parameters outside the
 * range Bitwarden clients produce.
 *
 * Import files come from wherever the user obtained them, so the parameters are attacker
 * controlled. Argon2 in particular allocates `kdfMemory` MiB up front, so an unbounded value is a
 * client denial of service. Validate before deriving anything.
 *
 * @returns the configuration, or `null` if any parameter is out of bounds or the KDF type is unknown.
 */
export function kdfConfigFromPasswordProtectedExport(
  jdoc: BitwardenPasswordProtectedFileFormat,
): KdfConfig | null {
  switch (jdoc.kdfType) {
    case KdfType.PBKDF2_SHA256:
      if (inBounds(jdoc.kdfIterations, PBKDF2_IMPORT_ITERATIONS)) {
        return new PBKDF2KdfConfig(jdoc.kdfIterations);
      }
      return null;

    case KdfType.Argon2id:
      if (
        inBounds(jdoc.kdfIterations, ARGON2_IMPORT_ITERATIONS) &&
        inBounds(jdoc.kdfMemory, ARGON2_IMPORT_MEMORY) &&
        inBounds(jdoc.kdfParallelism, ARGON2_IMPORT_PARALLELISM)
      ) {
        return new Argon2KdfConfig(jdoc.kdfIterations, jdoc.kdfMemory, jdoc.kdfParallelism);
      }
      return null;

    default:
      return null;
  }
}

function inBounds(value: number | undefined, range: RangeWithDefault): value is number {
  return value != null && Number.isInteger(value) && range.inRange(value);
}
