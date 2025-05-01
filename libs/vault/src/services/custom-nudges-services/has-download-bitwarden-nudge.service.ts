import { Injectable, inject } from "@angular/core";
import { Observable, from, of, switchMap } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { VaultNudgeType } from "../vault-nudges.service";

/**
 * Custom Nudge Service to use for the DownloadBitwarden Nudges in the Vault
 */
@Injectable({
  providedIn: "root",
})
export class HasDownloadBitwardenNudgeService extends DefaultSingleNudgeService {
  vaultProfileService = inject(VaultProfileService);

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    return this.isDismissed$(nudgeType, userId).pipe(
      switchMap((dismissed) => {
        if (dismissed) {
          return of(false);
        }
        return from(this.vaultProfileService.getProfileCreationDate(userId)).pipe(
          switchMap((profileCreatedDate) => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);
            return of(profileCreatedDate <= cutoffDate);
          }),
        );
      }),
    );
  }
}
