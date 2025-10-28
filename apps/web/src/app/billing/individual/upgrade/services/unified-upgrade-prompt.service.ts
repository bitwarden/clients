import { Injectable } from "@angular/core";
import { combineLatest, firstValueFrom, timeout, from, Observable, of } from "rxjs";
import { filter, switchMap, take, map } from "rxjs/operators";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync/sync.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogResult,
} from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

@Injectable({
  providedIn: "root",
})
export class UnifiedUpgradePromptService {
  private unifiedUpgradeDialogRef: DialogRef<UnifiedUpgradeDialogResult> | null = null;
  constructor(
    private accountService: AccountService,
    private configService: ConfigService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private vaultProfileService: VaultProfileService,
    private syncService: SyncService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  private shouldShowPrompt$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    switchMap((account) => {
      // Check self-hosted first before any other operations
      if (this.platformUtilsService.isSelfHost()) {
        return of(false);
      }

      if (!account) {
        return of(false);
      }

      const isProfileLessThanFiveMinutesOld = from(
        this.isProfileLessThanFiveMinutesOld(account.id),
      );
      const hasOrganizations = from(this.hasOrganizations(account.id));

      return combineLatest([
        isProfileLessThanFiveMinutesOld,
        hasOrganizations,
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        this.configService.getFeatureFlag$(FeatureFlag.PM24996_ImplementUpgradeFromFreeDialog),
      ]).pipe(
        map(([isProfileLessThanFiveMinutesOld, hasOrganizations, hasPremium, isFlagEnabled]) => {
          return (
            isProfileLessThanFiveMinutesOld && !hasOrganizations && !hasPremium && isFlagEnabled
          );
        }),
      );
    }),
    take(1),
  );

  /**
   * Conditionally prompt the user based on predefined criteria.
   *
   * @returns A promise that resolves to the dialog result if shown, or null if not shown
   */
  async displayUpgradePromptConditionally(): Promise<UnifiedUpgradeDialogResult | null> {
    const shouldShow = await firstValueFrom(this.shouldShowPrompt$);

    if (shouldShow) {
      return this.launchUpgradeDialog();
    }

    return null;
  }

  /**
   * Checks if a user's profile was created less than five minutes ago
   * @param userId User ID to check
   * @returns Promise that resolves to true if profile was created less than five minutes ago
   */
  private async isProfileLessThanFiveMinutesOld(userId: string): Promise<boolean> {
    const createdAtDate = await this.vaultProfileService.getProfileCreationDate(userId);
    if (!createdAtDate) {
      return false;
    }
    const createdAtInMs = createdAtDate.getTime();
    const nowInMs = new Date().getTime();

    const differenceInMs = nowInMs - createdAtInMs;
    const msInAMinute = 1000 * 60; // 60 seconds * 1000ms
    const differenceInMinutes = Math.round(differenceInMs / msInAMinute);

    return differenceInMinutes <= 5;
  }

  private async launchUpgradeDialog(): Promise<UnifiedUpgradeDialogResult | null> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return null;
    }

    this.unifiedUpgradeDialogRef = UnifiedUpgradeDialogComponent.open(this.dialogService, {
      data: { account },
    });

    const result = await firstValueFrom(this.unifiedUpgradeDialogRef.closed);
    this.unifiedUpgradeDialogRef = null;

    // Return the result or null if the dialog was dismissed without a result
    return result || null;
  }

  /**
   * Checks if the user has any organization associated with their account
   * @param userId User ID to check
   * @returns Promise that resolves to true if user has any organizations, false otherwise
   */
  private async hasOrganizations(userId: UserId): Promise<boolean> {
    // Wait for sync to complete to ensure organizations are fully loaded
    // Also force a sync to ensure we have the latest data
    await this.syncService.fullSync(false);

    // Wait for the sync to complete with timeout to prevent hanging
    await firstValueFrom(
      this.syncService.lastSync$(userId).pipe(
        filter((lastSync) => lastSync !== null),
        take(1),
        timeout(30000), // 30 second timeout
      ),
    );

    // Check if user has any organization membership (any status including pending)
    // Try using memberOrganizations$ which might have different filtering logic
    const memberOrganizations = await firstValueFrom(
      this.organizationService.memberOrganizations$(userId),
    );

    return memberOrganizations.length > 0;
  }
}
