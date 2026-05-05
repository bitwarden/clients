import { Injectable } from "@angular/core";
import { combineLatest, firstValueFrom, timeout, Observable, of } from "rxjs";
import { filter, switchMap, take, map } from "rxjs/operators";

import { PremiumUpsellService } from "@bitwarden/angular/vault";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync/sync.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { BILLING_DISK, StateProvider, UserKeyDefinition } from "@bitwarden/state";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogResult,
  UnifiedUpgradeDialogStatus,
} from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

// State key for tracking premium modal dismissal
export const PREMIUM_MODAL_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  BILLING_DISK,
  "premiumModalDismissed",
  {
    deserializer: (value: boolean) => value,
    clearOn: [],
  },
);

@Injectable({
  providedIn: "root",
})
export class UnifiedUpgradePromptService {
  private unifiedUpgradeDialogRef: DialogRef<UnifiedUpgradeDialogResult> | null = null;
  constructor(
    private accountService: AccountService,
    private syncService: SyncService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
    private stateProvider: StateProvider,
    private logService: LogService,
    private premiumUpsellService: PremiumUpsellService,
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

      return combineLatest([
        this.hasDismissedModal$(account.id),
        this.hasOrganizations(account.id),
        of(this.premiumUpsellService.showUpsell()),
      ]).pipe(
        map(([hasDismissed, hasOrganizations, hasAgeAndCount]) => {
          return !hasDismissed && !hasOrganizations && hasAgeAndCount;
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

    // Save dismissal state when the modal is closed without upgrading
    if (result?.status === UnifiedUpgradeDialogStatus.Closed) {
      try {
        await this.stateProvider.setUserState(PREMIUM_MODAL_DISMISSED_KEY, true, account.id);
      } catch (error) {
        // Log the error but don't block the dialog from closing
        // The modal will still close properly even if persistence fails
        this.logService.error("Failed to save premium modal dismissal state:", error);
      }
    }

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

  /**
   * Checks if the user has previously dismissed the premium modal
   * @param userId User ID to check
   * @returns Observable that emits true if modal was dismissed, false otherwise
   */
  private hasDismissedModal$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUserState$(PREMIUM_MODAL_DISMISSED_KEY, userId)
      .pipe(map((dismissed) => dismissed ?? false));
  }
}
