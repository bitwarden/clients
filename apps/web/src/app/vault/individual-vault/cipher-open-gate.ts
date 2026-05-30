import { SafeInjectionToken } from "@bitwarden/ui-common";

export type CipherOpenVerdict = "open" | "handled";

export interface CipherOpenGate {
  check(cipher: { id: string }, userId: string): Promise<CipherOpenVerdict>;
}

export const CIPHER_OPEN_GATE = new SafeInjectionToken<CipherOpenGate>("CipherOpenGate");
