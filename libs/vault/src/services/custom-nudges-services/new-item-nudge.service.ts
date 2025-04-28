import { inject, Injectable } from "@angular/core";
import { combineLatest, Observable, of, switchMap } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, VaultNudgeType } from "../vault-nudges.service";

/**
 * Custom Nudge Service Checking Nudge Status For Vault New Item Types
 */
@Injectable({
  providedIn: "root",
})
export class NewItemNudgeService extends DefaultSingleNudgeService {
  cipherService = inject(CipherService);

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.getNudgeStatus$(nudgeType, userId),
      this.cipherService.cipherViews$(userId),
    ]).pipe(
      switchMap(([nudgeStatus, ciphers]) => {
        if (nudgeStatus.hasSpotlightDismissed) {
          return of(nudgeStatus);
        }

        let currentType: CipherType;

        switch (nudgeType) {
          case VaultNudgeType.newLoginItemDismiss:
            currentType = CipherType.Login;
            break;
          case VaultNudgeType.newCardItemDismiss:
            currentType = CipherType.Card;
            break;
          case VaultNudgeType.newIdentityItemDismiss:
            currentType = CipherType.Identity;
            break;
          case VaultNudgeType.newNoteItemDismiss:
            currentType = CipherType.SecureNote;
            break;
          case VaultNudgeType.newSshItemDismiss:
            currentType = CipherType.SshKey;
            break;
        }

        const ciphersBoolean = ciphers.some((cipher) => cipher.type === currentType);

        if (ciphersBoolean) {
          const dismissedStatus = {
            hasSpotlightDismissed: true,
            hasBadgeDismissed: true,
          };
          void this.setNudgeStatus(nudgeType, dismissedStatus, userId);
          return of(dismissedStatus);
        }

        return of(nudgeStatus);
      }),
    );
  }
}
