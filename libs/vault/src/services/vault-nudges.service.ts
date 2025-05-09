import { inject, Injectable } from "@angular/core";
import { of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserKeyDefinition, VAULT_NUDGES_DISK } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import {
  HasItemsNudgeService,
  EmptyVaultNudgeService,
  NewItemNudgeService,
} from "./custom-nudges-services";
import { DefaultSingleNudgeService, SingleNudgeService } from "./default-single-nudge.service";

export type NudgeStatus = {
  hasBadgeDismissed: boolean;
  hasSpotlightDismissed: boolean;
};

/**
 * Enum to list the various nudge types, to be used by components/badges to show/hide the nudge
 */
export enum VaultNudgeType {
  /** Nudge to show when user has no items in their vault
   * Add future nudges here
   */
  EmptyVaultNudge = "empty-vault-nudge",
  HasVaultItems = "has-vault-items",
  newLoginItemStatus = "new-login-item-status",
  newCardItemStatus = "new-card-item-status",
  newIdentityItemStatus = "new-identity-item-status",
  newNoteItemStatus = "new-note-item-status",
  newSshItemStatus = "new-ssh-item-status",
}

export const VAULT_NUDGE_DISMISSED_DISK_KEY = new UserKeyDefinition<
  Partial<Record<VaultNudgeType, NudgeStatus>>
>(VAULT_NUDGES_DISK, "vaultNudgeDismissed", {
  deserializer: (nudge) => nudge,
  clearOn: [], // Do not clear dismissals
});

@Injectable({
  providedIn: "root",
})
export class VaultNudgesService {
  private newItemNudgeService = inject(NewItemNudgeService);

  /**
   * Custom nudge services to use for specific nudge types
   * Each nudge type can have its own service to determine when to show the nudge
   * @private
   */
  private customNudgeServices: any = {
    [VaultNudgeType.HasVaultItems]: inject(HasItemsNudgeService),
    [VaultNudgeType.EmptyVaultNudge]: inject(EmptyVaultNudgeService),
    [VaultNudgeType.newLoginItemStatus]: this.newItemNudgeService,
    [VaultNudgeType.newCardItemStatus]: this.newItemNudgeService,
    [VaultNudgeType.newIdentityItemStatus]: this.newItemNudgeService,
    [VaultNudgeType.newNoteItemStatus]: this.newItemNudgeService,
    [VaultNudgeType.newSshItemStatus]: this.newItemNudgeService,
  };

  /**
   * Default nudge service to use when no custom service is available
   * Simply stores the dismissed state in the user's state
   * @private
   */
  private defaultNudgeService = inject(DefaultSingleNudgeService);
  private configService = inject(ConfigService);

  private getNudgeService(nudge: VaultNudgeType): SingleNudgeService {
    return this.customNudgeServices[nudge] ?? this.defaultNudgeService;
  }

  /**
   * Check if a nudge should be shown to the user
   * @param nudge
   * @param userId
   */
  showNudge$(nudge: VaultNudgeType, userId: UserId) {
    return this.configService.getFeatureFlag$(FeatureFlag.PM8851_BrowserOnboardingNudge).pipe(
      switchMap((hasVaultNudgeFlag) => {
        if (!hasVaultNudgeFlag) {
          return of({ hasBadgeDismissed: true, hasSpotlightDismissed: true } as NudgeStatus);
        }
        return this.getNudgeService(nudge).nudgeStatus$(nudge, userId);
      }),
    );
  }

  /**
   * Dismiss a nudge for the user so that it is not shown again
   * @param nudge
   * @param userId
   */
  async dismissNudge(nudge: VaultNudgeType, userId: UserId, onlyBadge: boolean = false) {
    const dismissedStatus = onlyBadge
      ? { hasBadgeDismissed: true, hasSpotlightDismissed: false }
      : { hasBadgeDismissed: true, hasSpotlightDismissed: true };
    await this.getNudgeService(nudge).setNudgeStatus(nudge, dismissedStatus, userId);
  }
}
