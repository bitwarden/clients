import { concat, defer, firstValueFrom, map, Observable, of, switchMap, timer } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherLeaseStateService } from "@bitwarden/common/vault/abstractions/cipher-lease-state.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import {
  LEASED_CIPHERS,
  LeasedCipherEntry,
  LeasedCipherState,
  liveLeasedCiphers,
} from "./leased-cipher.state";

/** Longer timer delays overflow and fire at once. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/** Reads the copies the background stores, so it serves both the worker and the popup. */
export class BrowserCipherLeaseStateService implements CipherLeaseStateService {
  constructor(
    private stateProvider: StateProvider,
    private accountService: AccountService,
  ) {}

  async leasedCipherIds(): Promise<Set<string>> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
    if (userId == null) {
      return new Set();
    }
    return new Set(Object.keys(await firstValueFrom(this.live$(userId))));
  }

  leasedCiphers$(userId: UserId): Observable<Cipher[]> {
    return this.live$(userId).pipe(
      map((live) => Object.values(live).map((entry) => new Cipher(entry.cipher))),
    );
  }

  private live$(userId: UserId): Observable<Record<string, LeasedCipherEntry>> {
    return this.stateProvider
      .getUser(userId, LEASED_CIPHERS)
      .state$.pipe(switchMap((state) => liveUntilEachLapse$(state)));
  }
}

/** Re-emits as each lease lapses, since natural expiry sends no push and an alarm may be late. */
export function liveUntilEachLapse$(
  state: LeasedCipherState | null,
): Observable<Record<string, LeasedCipherEntry>> {
  return defer(() => {
    const now = Date.now();
    const live = liveLeasedCiphers(state, now);
    const ends = Object.values(live).map((entry) => Date.parse(entry.notAfter));
    if (ends.length === 0) {
      return of(live);
    }
    const delay = Math.min(Math.min(...ends) - now, MAX_TIMER_MS);
    return concat(of(live), timer(delay).pipe(switchMap(() => liveUntilEachLapse$(state))));
  });
}
