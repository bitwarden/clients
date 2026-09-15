import { RangeWithDefault } from "@bitwarden/common/platform/misc/range-with-default";
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";
import { BitwardenPasswordProtectedFileFormat } from "@bitwarden/vault-export-core";

/**
 * Iteration bounds accepted for a PBKDF2 import file.
 *
 * Wider than {@link PBKDF2KdfConfig.ITERATIONS} on the low end, because an export carries the
 * KDF configuration that was current when it was created and older clients allowed lower
 * iteration counts. The upper bound is the same one the settings UI enforces.
 */
const PBKDF2_IMPORT_ITERATIONS = new RangeWithDefault(
  PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN,
  PBKDF2KdfConfig.ITERATIONS.max,
  PBKDF2KdfConfig.ITERATIONS.defaultValue,
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
        inBounds(jdoc.kdfIterations, Argon2KdfConfig.ITERATIONS) &&
        inBounds(jdoc.kdfMemory, Argon2KdfConfig.MEMORY) &&
        inBounds(jdoc.kdfParallelism, Argon2KdfConfig.PARALLELISM)
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
