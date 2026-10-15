import { NgZone } from "@angular/core";
import { Observable } from "rxjs";

import { runInsideAngular } from "@bitwarden/browser/platform/browser/run-inside-angular.operator";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import { BrowserCipherLeaseStateService } from "../browser-cipher-lease-state.service";

/** Lease updates arrive as `chrome.storage` events outside the zone, so every reader re-enters it here. */
export class PopupCipherLeaseStateService extends BrowserCipherLeaseStateService {
  constructor(
    stateProvider: StateProvider,
    accountService: AccountService,
    private readonly ngZone: NgZone,
  ) {
    super(stateProvider, accountService);
  }

  override leasedCiphers$(userId: UserId): Observable<Cipher[]> {
    return super.leasedCiphers$(userId).pipe(runInsideAngular(this.ngZone));
  }
}
