import { Injectable } from "@angular/core";
import { Observable, combineLatest, firstValueFrom, map, filter, mergeMap, take } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  StateProvider,
  PREMIUM_BANNER_DISK_LOCAL,
  BANNERS_DISMISSED_DISK,
  UserKeyDefinition,
  SingleUserState,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { PBKDF2KdfConfig, KdfConfigService, KdfType } from "@bitwarden/key-management";

export enum VisibleVaultBanner {
  KDFSettings = "kdf-settings",
  OutdatedBrowser = "outdated-browser",
  Premium = "premium",
  VerifyEmail = "verify-email",
  PendingAuthRequest = "pending-auth-request",
}

type PremiumBannerReprompt = {
  numberOfDismissals: number;
  /** Timestamp representing when to show the prompt next */
  nextPromptDate: number;
};

/** Banners that will be re-shown on a new session */
type SessionBanners = Omit<VisibleVaultBanner, VisibleVaultBanner.Premium>;

export const PREMIUM_BANNER_REPROMPT_KEY = new UserKeyDefinition<PremiumBannerReprompt>(
  PREMIUM_BANNER_DISK_LOCAL,
  "bannerReprompt",
  {
    deserializer: (bannerReprompt) => bannerReprompt,
    clearOn: [], // Do not clear user tutorials
  },
);

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
    private kdfConfigService: KdfConfigService,
    private syncService: SyncService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private devicesService: DevicesServiceAbstraction,
  ) {}

  /** Returns true when the pending auth request banner should be shown */
  async shouldShowPendingAuthRequestBanner(userId: UserId): Promise<boolean> {
    const devices = await firstValueFrom(this.devicesService.getDevices$());
    const hasPendingRequest = devices.some(
      (device) => device.response?.devicePendingAuthRequest != null,
    );

    const alreadyDismissed = (await this.getBannerDismissedState(userId)).includes(
      VisibleVaultBanner.PendingAuthRequest,
    );

    return hasPendingRequest && !alreadyDismissed;
  }

  shouldShowPremiumBanner$(userId: UserId): Observable<boolean> {
    const premiumBannerState = this.premiumBannerState(userId);
    const premiumSources$ = combineLatest([
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
      premiumBannerState.state$,
    ]);

    return this.syncService.lastSync$(userId).pipe(
      filter((lastSync) => lastSync !== null),
      take(1), // Wait until the first sync is complete before considering the premium status
      mergeMap(() => premiumSources$),
      map(([canAccessPremium, dismissedState]) => {
        const shouldShowPremiumBanner =
          !canAccessPremium && !this.platformUtilsService.isSelfHost();

        // Check if nextPromptDate is in the past passed
        if (shouldShowPremiumBanner && dismissedState?.nextPromptDate) {
          const nextPromptDate = new Date(dismissedState.nextPromptDate);
          const now = new Date();
          return now >= nextPromptDate;
        }

        return shouldShowPremiumBanner;
      }),
    );
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

  /** Returns true when the low KDF iteration banner should be shown */
  async shouldShowLowKDFBanner(userId: UserId): Promise<boolean> {
    const hasLowKDF = (
      await firstValueFrom(this.userDecryptionOptionsService.userDecryptionOptionsById$(userId))
    )?.hasMasterPassword
      ? await this.isLowKdfIteration(userId)
      : false;

    const alreadyDismissed = (await this.getBannerDismissedState(userId)).includes(
      VisibleVaultBanner.KDFSettings,
    );

    return hasLowKDF && !alreadyDismissed;
  }

  /** Dismiss the given banner and perform any respective side effects */
  async dismissBanner(userId: UserId, banner: SessionBanners): Promise<void> {
    if (banner === VisibleVaultBanner.Premium) {
      await this.dismissPremiumBanner(userId);
    } else {
      await this.sessionBannerState(userId).update((current) => {
        const bannersDismissed = current ?? [];

        return [...bannersDismissed, banner];
      });
    }
  }

  /**
   *
   * @returns a SingleUserState for the premium banner reprompt state
   */
  private premiumBannerState(userId: UserId): SingleUserState<PremiumBannerReprompt> {
    return this.stateProvider.getUser(userId, PREMIUM_BANNER_REPROMPT_KEY);
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

  /** Increment dismissal state of the premium banner  */
  private async dismissPremiumBanner(userId: UserId): Promise<void> {
    await this.premiumBannerState(userId).update((current) => {
      const numberOfDismissals = current?.numberOfDismissals ?? 0;
      const now = new Date();

      // Set midnight of the current day
      now.setHours(0, 0, 0, 0);

      // First dismissal, re-prompt in 1 week
      if (numberOfDismissals === 0) {
        now.setDate(now.getDate() + 7);
        return {
          numberOfDismissals: 1,
          nextPromptDate: now.getTime(),
        };
      }

      // Second dismissal, re-prompt in 1 month
      if (numberOfDismissals === 1) {
        now.setMonth(now.getMonth() + 1);
        return {
          numberOfDismissals: 2,
          nextPromptDate: now.getTime(),
        };
      }

      // 3+ dismissals, re-prompt each year
      // Avoid day/month edge cases and only increment year
      const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      nextYear.setHours(0, 0, 0, 0);
      return {
        numberOfDismissals: numberOfDismissals + 1,
        nextPromptDate: nextYear.getTime(),
      };
    });
  }

  private async isLowKdfIteration(userId: UserId) {
    const kdfConfig = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));
    return (
      kdfConfig != null &&
      kdfConfig.kdfType === KdfType.PBKDF2_SHA256 &&
      kdfConfig.iterations < PBKDF2KdfConfig.ITERATIONS.defaultValue
    );
  }
}
