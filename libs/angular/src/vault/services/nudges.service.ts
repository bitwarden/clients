import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, shareReplay } from "rxjs";

import { UserKeyDefinition, NUDGES_DISK } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";

import {
  NewAccountNudgeService,
  HasItemsNudgeService,
  EmptyVaultNudgeService,
  NewItemNudgeService,
  AccountSecurityNudgeService,
  VaultSettingsImportNudgeService,
  AutoConfirmNudgeService,
} from "./custom-nudges-services";
import { DefaultSingleNudgeService, SingleNudgeService } from "./default-single-nudge.service";

export type NudgeStatus = {
  hasBadgeDismissed: boolean;
  hasSpotlightDismissed: boolean;
};

/**
 * Enum to list the various nudge types, to be used by components/badges to show/hide the nudge
 */
export const NudgeType = {
  /** Nudge to show when user has no items in their vault */
  EmptyVaultNudge: "empty-vault-nudge",
  VaultSettingsImportNudge: "vault-settings-import-nudge",
  HasVaultItems: "has-vault-items",
  AutofillNudge: "autofill-nudge",
  AccountSecurity: "account-security",
  DownloadBitwarden: "download-bitwarden",
  NewLoginItemStatus: "new-login-item-status",
  NewCardItemStatus: "new-card-item-status",
  NewIdentityItemStatus: "new-identity-item-status",
  NewNoteItemStatus: "new-note-item-status",
  NewSshItemStatus: "new-ssh-item-status",
  GeneratorNudgeStatus: "generator-nudge-status",
  AutoConfirmNudge: "auto-confirm-nudge",
} as const;

export type NudgeType = UnionOfValues<typeof NudgeType>;

export const NUDGE_DISMISSED_DISK_KEY = new UserKeyDefinition<
  Partial<Record<NudgeType, NudgeStatus>>
>(NUDGES_DISK, "vaultNudgeDismissed", {
  deserializer: (nudge) => nudge,
  clearOn: [], // Do not clear dismissals
});

@Injectable({
  providedIn: "root",
})
export class NudgesService {
  private newItemNudgeService = inject(NewItemNudgeService);
  private newAcctNudgeService = inject(NewAccountNudgeService);

  /**
   * Custom nudge services to use for specific nudge types
   * Each nudge type can have its own service to determine when to show the nudge
   * @private
   */
  private customNudgeServices: Partial<Record<NudgeType, SingleNudgeService>> = {
    [NudgeType.HasVaultItems]: inject(HasItemsNudgeService),
    [NudgeType.EmptyVaultNudge]: inject(EmptyVaultNudgeService),
    [NudgeType.VaultSettingsImportNudge]: inject(VaultSettingsImportNudgeService),
    [NudgeType.AccountSecurity]: inject(AccountSecurityNudgeService),
    [NudgeType.AutofillNudge]: this.newAcctNudgeService,
    [NudgeType.DownloadBitwarden]: this.newAcctNudgeService,
    [NudgeType.GeneratorNudgeStatus]: this.newAcctNudgeService,
    [NudgeType.NewLoginItemStatus]: this.newItemNudgeService,
    [NudgeType.NewCardItemStatus]: this.newItemNudgeService,
    [NudgeType.NewIdentityItemStatus]: this.newItemNudgeService,
    [NudgeType.NewNoteItemStatus]: this.newItemNudgeService,
    [NudgeType.NewSshItemStatus]: this.newItemNudgeService,
    [NudgeType.AutoConfirmNudge]: inject(AutoConfirmNudgeService),
  };

  /**
   * Default nudge service to use when no custom service is available
   * Simply stores the dismissed state in the user's state
   * @private
   */
  private defaultNudgeService = inject(DefaultSingleNudgeService);

  private getNudgeService(nudge: NudgeType): SingleNudgeService {
    return this.customNudgeServices[nudge] ?? this.defaultNudgeService;
  }

  /**
   * Check if a nudge Spotlight should be shown to the user
   * @param nudge
   * @param userId
   */
  showNudgeSpotlight$(nudge: NudgeType, userId: UserId): Observable<boolean> {
    return this.getNudgeService(nudge)
      .nudgeStatus$(nudge, userId)
      .pipe(map((nudgeStatus) => !nudgeStatus.hasSpotlightDismissed));
  }

  /**
   * Check if a nudge Badge should be shown to the user
   * @param nudge
   * @param userId
   */
  showNudgeBadge$(nudge: NudgeType, userId: UserId): Observable<boolean> {
    return this.getNudgeService(nudge)
      .nudgeStatus$(nudge, userId)
      .pipe(map((nudgeStatus) => !nudgeStatus.hasBadgeDismissed));
  }

  /**
   * Check if a nudge should be shown to the user
   * @param nudge
   * @param userId
   */
  showNudgeStatus$(nudge: NudgeType, userId: UserId) {
    return this.getNudgeService(nudge).nudgeStatus$(nudge, userId);
  }

  /**
   * Dismiss a nudge for the user so that it is not shown again
   * @param nudge
   * @param userId
   */
  async dismissNudge(nudge: NudgeType, userId: UserId, onlyBadge: boolean = false) {
    const dismissedStatus = onlyBadge
      ? { hasBadgeDismissed: true, hasSpotlightDismissed: false }
      : { hasBadgeDismissed: true, hasSpotlightDismissed: true };
    await this.getNudgeService(nudge).setNudgeStatus(nudge, dismissedStatus, userId);
  }

  /**
   * Check if there are any active badges for the user to show Berry notification in Tabs
   * @param userId
   */
  hasActiveBadges$(userId: UserId): Observable<boolean> {
    // Add more nudge types here if they have the settings badge feature
    const nudgeTypes = [
      NudgeType.EmptyVaultNudge,
      NudgeType.DownloadBitwarden,
      NudgeType.AutofillNudge,
      NudgeType.AutoConfirmNudge,
    ];

    const nudgeTypesWithBadge$ = nudgeTypes.map((nudge) => {
      return this.getNudgeService(nudge)
        .nudgeStatus$(nudge, userId)
        .pipe(
          map((status) => !status?.hasBadgeDismissed),
          shareReplay({ refCount: false, bufferSize: 1 }),
        );
    });

    return combineLatest(nudgeTypesWithBadge$).pipe(
      map((results) => results.some((result) => result === true)),
    );
  }
}
