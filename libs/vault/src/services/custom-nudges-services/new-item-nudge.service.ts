import { inject, Injectable } from "@angular/core";
import { combineLatest, Observable, switchMap } from "rxjs";

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

  nudgeStatus$(nudgeType: VaultNudgeType, userId: UserId): Observable<NudgeStatus> {
    return combineLatest([
      this.getNudgeStatus$(nudgeType, userId),
      this.cipherService.cipherViews$(userId),
    ]).pipe(
      switchMap(async ([nudgeStatus, ciphers]) => {
        if (nudgeStatus.hasSpotlightDismissed) {
          return nudgeStatus;
        }

        let currentType: CipherType;

        switch (nudgeType) {
          case VaultNudgeType.newLoginItemStatus:
            currentType = CipherType.Login;
            break;
          case VaultNudgeType.newCardItemStatus:
            currentType = CipherType.Card;
            break;
          case VaultNudgeType.newIdentityItemStatus:
            currentType = CipherType.Identity;
            break;
          case VaultNudgeType.newNoteItemStatus:
            currentType = CipherType.SecureNote;
            break;
          case VaultNudgeType.newSshItemStatus:
            currentType = CipherType.SshKey;
            break;
        }

        const ciphersBoolean = ciphers.some((cipher) => cipher.type === currentType);

        if (ciphersBoolean) {
          const dismissedStatus = {
            hasSpotlightDismissed: true,
            hasBadgeDismissed: true,
          };
          await this.setNudgeStatus(nudgeType, dismissedStatus, userId);
          return dismissedStatus;
        }

        return nudgeStatus;
      }),
    );
  }
}
