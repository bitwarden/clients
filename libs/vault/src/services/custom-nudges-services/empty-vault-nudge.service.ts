import { inject, Injectable } from "@angular/core";
import { map, Observable, of, switchMap } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { VaultNudgeType } from "../vault-nudges.service";

/**
 * Custom Nudge Service Checking Nudge Status For Welcome Nudge For Empty Vault
 */
@Injectable({
  providedIn: "root",
})
export class EmptyVaultNudgeService extends DefaultSingleNudgeService {
  cipherService = inject(CipherService);

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    return this.isDismissed$(nudgeType, userId).pipe(
      switchMap((dismissed) =>
        dismissed
          ? of(false)
          : this.cipherService
              .cipherViews$(userId)
              .pipe(map((ciphers) => ciphers == null || ciphers.length === 0)),
      ),
    );
  }
}
