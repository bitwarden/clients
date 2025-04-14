import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { VaultNudgeType } from "../vault-nudges.service";

/**
 * Custom Nudge Service Checking Nudge Status For Welcome Nudge With Populated Vault
 */
@Injectable({
  providedIn: "root",
})
export class HasItemsNudgeService extends DefaultSingleNudgeService {
  cipherService = inject(CipherService);
  apiService = inject(ApiService);

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    return combineLatest([this.apiService.getProfile(), this.isDismissed$(nudgeType, userId)]).pipe(
      switchMap(([userProfile, dismissed]) => {
        const thirtyDays = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
        const profileCreationDate = new Date(userProfile.creationDate);
        const isRecentAcct = profileCreationDate >= thirtyDays;

        if (!isRecentAcct || dismissed) {
          return of(false);
        } else {
          return this.cipherService
            .cipherViews$(userId)
            .pipe(map((ciphers) => ciphers != null && ciphers.length > 0));
        }
      }),
    );
  }
}
