import { Jsonify } from "type-fest";

import { PAM_LEASED_CIPHERS_MEMORY, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";

export type LeasedCipherEntry = {
  leaseId: string;
  /** ISO timestamp the lease ends. */
  notAfter: string;
  /** Encrypted full copy. */
  cipher: CipherData;
};

export type LeasedCipherState = {
  refreshedAt: number;
  /** Keyed by cipher id. */
  leases: Record<string, LeasedCipherEntry>;
};

/** RAM-only: "memory" is `chrome.storage.session` on MV3, shared by the worker and the popup. */
export const LEASED_CIPHERS = new UserKeyDefinition<LeasedCipherState>(
  PAM_LEASED_CIPHERS_MEMORY,
  "leasedCiphers",
  {
    deserializer: (obj: Jsonify<LeasedCipherState>) => {
      if (obj?.leases == null) {
        return null;
      }
      const leases: Record<string, LeasedCipherEntry> = {};
      for (const [cipherId, entry] of Object.entries(obj.leases)) {
        if (entry?.cipher != null) {
          leases[cipherId] = { ...entry, cipher: CipherData.fromJSON(entry.cipher) };
        }
      }
      return { refreshedAt: obj.refreshedAt, leases };
    },
    clearOn: ["lock", "logout"],
  },
);

/** An unparseable `notAfter` counts as lapsed, failing closed. */
export function isLeaseLive(notAfter: string, nowMs: number): boolean {
  return Date.parse(notAfter) > nowMs;
}

export function liveLeasedCiphers(
  state: LeasedCipherState | null | undefined,
  nowMs: number,
): Record<string, LeasedCipherEntry> {
  return Object.fromEntries(
    Object.entries(state?.leases ?? {}).filter(([, entry]) => isLeaseLive(entry.notAfter, nowMs)),
  );
}
