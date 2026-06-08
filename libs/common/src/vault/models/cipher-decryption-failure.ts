import { CipherDecryptionFailure } from "@bitwarden/sdk-internal";

import { CipherId } from "../../types/guid";

/**
 * Per-cipher map of decryption failures produced by the SDK's graceful decrypt path.
 *
 * Keys are {@link CipherId}s for which at least one field failed to decrypt.
 * Values are the SDK-supplied failure list for that cipher — each entry contains
 * the dotted-camelCase `path` to the failed field, the stable `errorVariant`
 * name (safe to branch on), and a human-readable `errorMessage` (display only —
 * never branch on it).
 *
 * Ciphers with no failures are absent from the map.
 */
export type CipherDecryptionFailureMap = ReadonlyMap<CipherId, CipherDecryptionFailure[]>;

export { CipherDecryptionFailure };
