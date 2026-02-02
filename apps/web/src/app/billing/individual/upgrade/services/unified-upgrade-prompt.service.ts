import { Injectable } from "@angular/core";
import { firstValueFrom, timeout, Observable } from "rxjs";
import { filter, map, take } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync/sync.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { BILLING_DISK_LOCAL, StateProvider, UserKeyDefinition } from "@bitwarden/state";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogResult,
  UnifiedUpgradeDialogStatus,
} from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

// State key for tracking premium modal dismissal
export const PREMIUM_MODAL_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  BILLING_DISK_LOCAL,
  "premiumModalDismissed",
  {
    deserializer: (value: boolean) => value,
    clearOn: [],
  },
);

export const PREMIUM_MODAL_SESSION_COUNT_KEY = new UserKeyDefinition<number>(
  BILLING_DISK_LOCAL,
  "premiumModalSessionCount",
  {
    deserializer: (value: number) => value,
    clearOn: [],
  },
);

const PREMIUM_MODAL_SESSION_MARKER_PREFIX = "premiumModalSessionTracked";
const REQUIRED_SESSION_COUNT = 5;

@Injectable({
  providedIn: "root",
})
export class UnifiedUpgradePromptService {
  private unifiedUpgradeDialogRef: DialogRef<UnifiedUpgradeDialogResult> | null = null;
  constructor(
    private accountService: AccountService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private syncService: SyncService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
    private stateProvider: StateProvider,
    private logService: LogService,
  ) {}

  /**
   * Conditionally prompt the user based on predefined criteria.
   *
   * @returns A promise that resolves to the dialog result if shown, or null if not shown
   */
  async displayUpgradePromptConditionally(): Promise<UnifiedUpgradeDialogResult | null> {
    // Check self-hosted first before any other operations
    if (this.platformUtilsService.isSelfHost()) {
      return null;
    }

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return null;
    }

    // await this.migrateLegacyStateIfNeeded(account.id);

    const hasPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    );
    if (hasPremium) {
      return null;
    }

    const hasDismissed = await firstValueFrom(this.hasDismissedModal$(account.id).pipe(take(1)));
    if (hasDismissed) {
      return null;
    }

    const sessionCount = await this.incrementSessionCountIfNeeded(account.id);
    if (sessionCount < REQUIRED_SESSION_COUNT) {
      return null;
    }

    const hasOrganizations = await this.hasOrganizations(account.id);
    if (hasOrganizations) {
      return null;
    }

    return this.launchUpgradeDialog();
  }

  private getSessionCount$(userId: UserId): Observable<number> {
    return this.stateProvider
      .getUserState$(PREMIUM_MODAL_SESSION_COUNT_KEY, userId)
      .pipe(map((count) => count ?? 0));
  }

  private sessionMarkerKey(userId: UserId): string {
    return `${PREMIUM_MODAL_SESSION_MARKER_PREFIX}:${userId}`;
  }

  private hasIncrementedThisSession(userId: UserId): boolean {
    try {
      return (
        typeof window !== "undefined" &&
        !!window.sessionStorage?.getItem(this.sessionMarkerKey(userId))
      );
    } catch {
      return false;
    }
  }

  private markIncrementedThisSession(userId: UserId): void {
    try {
      if (typeof window === "undefined") {
        return;
      }
      window.sessionStorage?.setItem(this.sessionMarkerKey(userId), "1");
    } catch {
      // ignore
    }
  }

  /**
   * Increments the stored session count at most once per browser session.
   * Returns the effective session count after any increment.
   */
  private async incrementSessionCountIfNeeded(userId: UserId): Promise<number> {
    const currentCount = await firstValueFrom(this.getSessionCount$(userId).pipe(take(1)));
    if (this.hasIncrementedThisSession(userId)) {
      return currentCount;
    }

    const nextCount = currentCount + 1;
    try {
      await this.stateProvider.setUserState(PREMIUM_MODAL_SESSION_COUNT_KEY, nextCount, userId);
      this.markIncrementedThisSession(userId);
    } catch (error) {
      this.logService.error("Failed to save premium modal session count:", error);
      // If persistence fails, don't block the prompt logic; return the pre-increment count.
      return currentCount;
    }

    return nextCount;
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
