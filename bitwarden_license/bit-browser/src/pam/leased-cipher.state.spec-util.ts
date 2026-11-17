import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";

import { LEASED_CIPHERS, LeasedCipherEntry } from "./leased-cipher.state";

export const NOW = new Date("2026-10-15T12:00:00.000Z").getTime();

/** ISO timestamp `offsetMs` from {@link NOW}. */
export const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

export const IN_AN_HOUR = at(60 * 60 * 1000);

export const leaseEntry = (cipherId: string, notAfter = IN_AN_HOUR): LeasedCipherEntry => ({
  leaseId: `lease-${cipherId}`,
  notAfter,
  cipher: Object.assign(new CipherData(), { id: cipherId }),
});

export const seedLeases = (
  stateProvider: StateProvider,
  userId: UserId,
  entries: LeasedCipherEntry[],
  refreshedAt = NOW,
) =>
  stateProvider.setUserState(
    LEASED_CIPHERS,
    { refreshedAt, leases: Object.fromEntries(entries.map((e) => [e.cipher.id, e])) },
    userId,
  );
