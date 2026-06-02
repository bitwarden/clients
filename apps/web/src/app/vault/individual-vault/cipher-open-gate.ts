import { SafeInjectionToken } from "@bitwarden/ui-common";

export type CipherOpenVerdict = "open" | "handled";

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
