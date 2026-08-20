/**
 * @deprecated Moved to `@bitwarden/legacy-crypto`. These primitives are being retired in favour of
 * the SDK — do not add new callers. Contact the Key Management team.
 */
export {
  Argon2KdfConfig,
  DEFAULT_KDF_CONFIG,
  fromSdkKdfConfig,
  PBKDF2KdfConfig,
} from "@bitwarden/legacy-crypto/models/kdf-config";
export type { KdfConfig } from "@bitwarden/legacy-crypto/models/kdf-config";
