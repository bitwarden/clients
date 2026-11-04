import { NgZone } from "@angular/core";
import { Observable } from "rxjs";

import { runInsideAngular } from "@bitwarden/browser/platform/browser/run-inside-angular.operator";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BrowserRevealedCipherService } from "../browser-revealed-cipher.service";

/** Lease updates arrive as `chrome.storage` events outside the zone, so every reader re-enters it here. */
export class PopupRevealedCipherService extends BrowserRevealedCipherService {
  constructor(
    stateProvider: StateProvider,
    authService: AuthService,
    cipherService: CipherService,
    messageSender: MessageSender,
    logService: LogService,
    private readonly ngZone: NgZone,
  ) {
    super(stateProvider, authService, cipherService, messageSender, logService);
  }

  override revealed$(userId: UserId): Observable<ReadonlyMap<CipherId, CipherView>> {
    return super.revealed$(userId).pipe(runInsideAngular(this.ngZone));
  }
}
