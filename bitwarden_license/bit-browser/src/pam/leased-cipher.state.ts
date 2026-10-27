import { concat, defer, distinctUntilChanged, Observable, of, switchMap, timer } from "rxjs";
import { Jsonify } from "type-fest";

// Deep import: the `pam` barrel pulls Angular components into the worker bundle.
import { isLeaseLive } from "@bitwarden/bit-common/pam/helpers/lease-liveness";
import {
  PAM_LEASED_CIPHERS_MEMORY,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
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

/** Longer timer delays overflow and fire at once. */
const MAX_TIMER_MS = 2 ** 31 - 1;

type LeasedCiphers = Record<string, LeasedCipherEntry>;

export function liveLeasedCiphers(leases: LeasedCiphers | undefined, nowMs: number): LeasedCiphers {
  return Object.fromEntries(
    Object.entries(leases ?? {}).filter(([, entry]) => isLeaseLive(entry, nowMs)),
  );
}

/**
 * The user's live copies. Re-emits as each lease lapses, since natural expiry sends no push, but
 * not for a rewrite that changes no copy.
 */
export function liveLeases$(
  stateProvider: StateProvider,
  userId: UserId,
): Observable<LeasedCiphers> {
  return stateProvider.getUser(userId, LEASED_CIPHERS).state$.pipe(
    switchMap((state) => liveUntilEachLapse$(state?.leases)),
    distinctUntilChanged(sameEntries),
  );
}

function liveUntilEachLapse$(leases: LeasedCiphers | undefined): Observable<LeasedCiphers> {
  return defer(() => {
    const now = Date.now();
    const live = liveLeasedCiphers(leases, now);
    const ends = Object.values(live).map((entry) => Date.parse(entry.notAfter));
    if (ends.length === 0) {
      return of(live);
    }
    const delay = Math.min(Math.min(...ends) - now, MAX_TIMER_MS);
    return concat(of(live), timer(delay).pipe(switchMap(() => liveUntilEachLapse$(leases))));
  });
}

function sameEntries(a: LeasedCiphers, b: LeasedCiphers): boolean {
  const ids = Object.keys(a);
  return (
    ids.length === Object.keys(b).length &&
    ids.every(
      (id) =>
        b[id] != null &&
        a[id].leaseId === b[id].leaseId &&
        a[id].notAfter === b[id].notAfter &&
        a[id].cipher.revisionDate === b[id].cipher.revisionDate,
    )
  );
}
