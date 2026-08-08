import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Verdict returned by the open gate.
 *
 * - `"open"` — proceed with the cipher already in local state.
 * - `"handled"` — the gate took care of the interaction (modal, error
 *   dialog, etc.); the caller should not open the view dialog.
 * - `{ kind: "openWith", cipher }` — proceed, but render the supplied
 *   {@link Cipher} instead of the locally-cached one. Used by the PAM gate
 *   to substitute a transient leased-cipher fetched from the server so the
 *   local cache stays partial-data.
 */
export type CipherOpenVerdict = "open" | "handled" | { kind: "openWith"; cipher: Cipher };

/**
 * Structural shape of the cipher passed to {@link CipherOpenGate.check}. We
 * only need the id plus `partialData` — its presence is the signal that the
 * server gates this cipher behind a PAM access rule.
 */
export type GatedCipherLike = {
  id: string;
  partialData?: string;
};

export interface CipherOpenGate {
  check(cipher: GatedCipherLike, userId: string): Promise<CipherOpenVerdict>;
}

export const CIPHER_OPEN_GATE = new SafeInjectionToken<CipherOpenGate>("CipherOpenGate");
