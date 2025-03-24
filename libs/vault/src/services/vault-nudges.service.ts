import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  StateProvider,
  UserKeyDefinition,
  VAULT_NUDGES_DISK,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { VaultOnboardingNudgesService } from "./custom-nudges-services/vault-onboarding-nudges.service";

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

/**
 * Base interface for handling a nudge's status
 */
export interface SingleNudgeService {
  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean>;
  setNudgeStatus(nudgeType: VaultNudgeType, dismissed: boolean, userId: UserId): Promise<void>;
}

/**
 * Default implementation for nudges. Set and Show Nudge dismissed state
 */
@Injectable({
  providedIn: "root",
})
export class DefaultSingleNudgeService implements SingleNudgeService {
  stateProvider = inject(StateProvider);

  protected isDismissed$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, VAULT_NUDGE_DISMISSED_DISK_KEY)
      .state$.pipe(map((nudges) => nudges?.includes(nudgeType) ?? false));
  }

  shouldShowNudge$(nudgeType: VaultNudgeType, userId: UserId): Observable<boolean> {
    return this.isDismissed$(nudgeType, userId).pipe(map((dismissed) => !dismissed));
  }

  async setNudgeStatus(
    nudgeType: VaultNudgeType,
    dismissed: boolean,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.getUser(userId, VAULT_NUDGE_DISMISSED_DISK_KEY).update((nudges) => {
      nudges ??= [];
      if (dismissed) {
        nudges.push(nudgeType);
      } else {
        nudges = nudges.filter((n) => n !== nudgeType);
      }
      return nudges;
    });
  }
}

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
    [VaultNudgeType.HasVaultItems]: inject(VaultOnboardingNudgesService),
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
