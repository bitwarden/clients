import { Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  StateProvider,
  BANNERS_DISMISSED_DISK,
  UserKeyDefinition,
  SingleUserState,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";

export const VisibleVaultBanner = {
  OutdatedBrowser: "outdated-browser",
  VerifyEmail: "verify-email",
  PendingAuthRequest: "pending-auth-request",
} as const;

export type VisibleVaultBanner = UnionOfValues<typeof VisibleVaultBanner>;

/** Banners that will be re-shown on a new session */
type SessionBanners = VisibleVaultBanner;

export const BANNERS_DISMISSED_DISK_KEY = new UserKeyDefinition<SessionBanners[]>(
  BANNERS_DISMISSED_DISK,
  "bannersDismissed",
  {
    deserializer: (bannersDismissed) => bannersDismissed,
    clearOn: [], // Do not clear user tutorials
  },
);

@Injectable()
export class VaultBannersService {
  constructor(
    private accountService: AccountService,
    private stateProvider: StateProvider,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private platformUtilsService: PlatformUtilsService,
    private syncService: SyncService,
    private authRequestService: AuthRequestServiceAbstraction,
  ) {}

  /** Returns true when the pending auth request banner should be shown */
  async shouldShowPendingAuthRequestBanner(userId: UserId): Promise<boolean> {
    const alreadyDismissed = (await this.getBannerDismissedState(userId)).includes(
      VisibleVaultBanner.PendingAuthRequest,
    );

    const pendingAuthRequests = await firstValueFrom(
      this.authRequestService.getPendingAuthRequests$(),
    );

    return pendingAuthRequests.length > 0 && !alreadyDismissed;
  }

  /** Returns true when the update browser banner should be shown */
  async shouldShowUpdateBrowserBanner(userId: UserId): Promise<boolean> {
    const outdatedBrowser = window.navigator.userAgent.indexOf("MSIE") !== -1;
    const alreadyDismissed = (await this.getBannerDismissedState(userId)).includes(
      VisibleVaultBanner.OutdatedBrowser,
    );

    return outdatedBrowser && !alreadyDismissed;
  }

  /** Returns true when the verify email banner should be shown */
  async shouldShowVerifyEmailBanner(userId: UserId): Promise<boolean> {
    const needsVerification = !(
      await firstValueFrom(this.accountService.accounts$.pipe(map((accounts) => accounts[userId])))
    )?.emailVerified;

    const alreadyDismissed = (await this.getBannerDismissedState(userId)).includes(
      VisibleVaultBanner.VerifyEmail,
    );

    return needsVerification && !alreadyDismissed;
  }

  /** Dismiss the given banner and perform any respective side effects */
  async dismissBanner(userId: UserId, banner: SessionBanners): Promise<void> {
    await this.sessionBannerState(userId).update((current) => {
      const bannersDismissed = current ?? [];

      return [...bannersDismissed, banner];
    });
  }

  /**
   *
   * @returns a SingleUserState for the session banners dismissed state
   */
  private sessionBannerState(userId: UserId): SingleUserState<SessionBanners[]> {
    return this.stateProvider.getUser(userId, BANNERS_DISMISSED_DISK_KEY);
  }

  /** Returns banners that have already been dismissed */
  private async getBannerDismissedState(userId: UserId): Promise<SessionBanners[]> {
    // `state$` can emit null when a value has not been set yet,
    // use nullish coalescing to default to an empty array
    return (await firstValueFrom(this.sessionBannerState(userId).state$)) ?? [];
  }
}
