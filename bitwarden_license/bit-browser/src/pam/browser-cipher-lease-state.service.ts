import { firstValueFrom, map, Observable } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherLeaseStateService } from "@bitwarden/common/vault/abstractions/cipher-lease-state.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import { liveLeases$ } from "./leased-cipher.state";

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
    return new Set(Object.keys(await firstValueFrom(liveLeases$(this.stateProvider, userId))));
  }

  leasedCiphers$(userId: UserId): Observable<Cipher[]> {
    return liveLeases$(this.stateProvider, userId).pipe(
      map((live) => Object.values(live).map((entry) => new Cipher(entry.cipher))),
    );
  }
}
