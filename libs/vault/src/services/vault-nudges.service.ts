import { inject, Injectable } from "@angular/core";

import { UserKeyDefinition, VAULT_NUDGES_DISK } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { HasItemsNudgeService } from "./custom-nudges-services/has-items-nudge.service";
import { DefaultSingleNudgeService, SingleNudgeService } from "./default-single-nudge.service";

/**
 * Enum to list the various nudge types, to be used by components/badges to show/hide the nudge
 */
export enum VaultNudgeType {
  /** Nudge to show when user has no items in their vault
   * Add future nudges here
   */
  HasVaultItems = "has-vault-items",
  IntroCarouselDismissal = "intro-carousel-dismissal",
}

export const VAULT_NUDGE_DISMISSED_DISK_KEY = new UserKeyDefinition<VaultNudgeType[]>(
  VAULT_NUDGES_DISK,
  "vaultNudgeDismissed",
  {
    deserializer: (nudgeDismissed) => nudgeDismissed,
    clearOn: [], // Do not clear dismissals
  },
);

@Injectable({
  providedIn: "root",
})
export class VaultNudgesService {
  /**
   * Custom nudge services to use for specific nudge types
   * Each nudge type can have its own service to determine when to show the nudge
   * @private
   */
  private customNudgeServices: any = {
    [VaultNudgeType.HasVaultItems]: inject(HasItemsNudgeService),
  };

  /**
   * Default nudge service to use when no custom service is available
   * Simply stores the dismissed state in the user's state
   * @private
   */
  private defaultNudgeService = inject(DefaultSingleNudgeService);

  private getNudgeService(nudge: VaultNudgeType): SingleNudgeService {
    return this.customNudgeServices[nudge] ?? this.defaultNudgeService;
  }

  /**
   * Check if a nudge should be shown to the user
   * @param nudge
   * @param userId
   */
  showNudge$(nudge: VaultNudgeType, userId: UserId) {
    return this.getNudgeService(nudge).shouldShowNudge$(nudge, userId);
  }

  /**
   * Dismiss a nudge for the user so that it is not shown again
   * @param nudge
   * @param userId
   */
  dismissNudge(nudge: VaultNudgeType, userId: UserId) {
    return this.getNudgeService(nudge).setNudgeStatus(nudge, true, userId);
  }
}
