import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Verdict returned by the open gate.
 *
 * - `"open"` — proceed with the cipher already in local state.
 * - `{ kind: "openWith", cipher }` — proceed, but render the supplied {@link Cipher}
 *   instead of the locally-cached one. Lets a gate substitute a transient full cipher
 *   fetched from the server while the local cache keeps only partial data.
 */
export type CipherOpenVerdict = "open" | { kind: "openWith"; cipher: Cipher };

/**
 * Structural shape of the cipher passed to {@link CipherOpenGate.check}. Only the id and
 * `partialData` are needed — the latter's presence is the signal that the server gates
 * this cipher.
 */
export type GatedCipherLike = {
  id: string;
  partialData?: string;
};

/**
 * Optional seam consulted when a vault row is opened. A host that surfaces a
 * privileged-access feature provides an implementation; without one the vault opens
 * every cipher straight from local state.
 */
export interface CipherOpenGate {
  check(cipher: GatedCipherLike, userId: string): Promise<CipherOpenVerdict>;
}

export const CIPHER_OPEN_GATE = new SafeInjectionToken<CipherOpenGate>("CipherOpenGate");
