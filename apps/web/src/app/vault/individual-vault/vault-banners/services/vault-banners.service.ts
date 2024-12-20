import { Injectable } from "@angular/core";
import {
  Subject,
  Observable,
  combineLatest,
  firstValueFrom,
  map,
  mergeMap,
  take,
  switchMap,
  of,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  StateProvider,
  ActiveUserState,
  PREMIUM_BANNER_DISK_LOCAL,
  BANNERS_DISMISSED_DISK,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { PBKDF2KdfConfig, KdfConfigService, KdfType } from "@bitwarden/key-management";

export enum VisibleVaultBanner {
  KDFSettings = "kdf-settings",
  OutdatedBrowser = "outdated-browser",
  Premium = "premium",
  VerifyEmail = "verify-email",
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
  shouldShowPremiumBanner$: Observable<boolean>;

  private premiumBannerState: ActiveUserState<PremiumBannerReprompt>;
  private sessionBannerState: ActiveUserState<SessionBanners[]>;

  /**
   * Emits when the sync service has completed a sync
   *
   * This is needed because `hasPremiumFromAnySource$` will emit false until the sync is completed
   * resulting in the premium banner being shown briefly on startup when the user has access to
   * premium features.
   */
  private syncCompleted$ = new Subject<void>();

  constructor(
    private tokenService: TokenService,
    private userVerificationService: UserVerificationService,
    private stateProvider: StateProvider,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private platformUtilsService: PlatformUtilsService,
    private kdfConfigService: KdfConfigService,
    private syncService: SyncService,
    private accountService: AccountService,
  ) {
    this.pollUntilSynced();
    this.premiumBannerState = this.stateProvider.getActive(PREMIUM_BANNER_REPROMPT_KEY);
    this.sessionBannerState = this.stateProvider.getActive(BANNERS_DISMISSED_DISK_KEY);

    const premiumSources$ = this.accountService.activeAccount$.pipe(
      take(1),
      switchMap((account) => {
        return combineLatest([
          account
            ? this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id)
            : of(false),
          this.premiumBannerState.state$,
        ]);
      }),
    );

    this.shouldShowPremiumBanner$ = this.syncCompleted$.pipe(
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
  async shouldShowUpdateBrowserBanner(): Promise<boolean> {
    const outdatedBrowser = window.navigator.userAgent.indexOf("MSIE") !== -1;
    const alreadyDismissed = (await this.getBannerDismissedState()).includes(
      VisibleVaultBanner.OutdatedBrowser,
    );

    return outdatedBrowser && !alreadyDismissed;
  }

  /** Returns true when the verify email banner should be shown */
  async shouldShowVerifyEmailBanner(): Promise<boolean> {
    const needsVerification = !(await this.tokenService.getEmailVerified());

    const alreadyDismissed = (await this.getBannerDismissedState()).includes(
      VisibleVaultBanner.VerifyEmail,
    );

    return needsVerification && !alreadyDismissed;
  }

  /** Returns true when the low KDF iteration banner should be shown */
  async shouldShowLowKDFBanner(): Promise<boolean> {
    const hasLowKDF = (await this.userVerificationService.hasMasterPassword())
      ? await this.isLowKdfIteration()
      : false;

    const alreadyDismissed = (await this.getBannerDismissedState()).includes(
      VisibleVaultBanner.KDFSettings,
    );

    return hasLowKDF && !alreadyDismissed;
  }

  /** Dismiss the given banner and perform any respective side effects */
  async dismissBanner(banner: SessionBanners): Promise<void> {
    if (banner === VisibleVaultBanner.Premium) {
      await this.dismissPremiumBanner();
    } else {
      await this.sessionBannerState.update((current) => {
        const bannersDismissed = current ?? [];

        return [...bannersDismissed, banner];
      });
    }
  }

  /** Returns banners that have already been dismissed */
  private async getBannerDismissedState(): Promise<SessionBanners[]> {
    // `state$` can emit null when a value has not been set yet,
    // use nullish coalescing to default to an empty array
    return (await firstValueFrom(this.sessionBannerState.state$)) ?? [];
  }

  /** Increment dismissal state of the premium banner  */
  private async dismissPremiumBanner(): Promise<void> {
    await this.premiumBannerState.update((current) => {
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

  private async isLowKdfIteration() {
    const kdfConfig = await this.kdfConfigService.getKdfConfig();
    return (
      kdfConfig.kdfType === KdfType.PBKDF2_SHA256 &&
      kdfConfig.iterations < PBKDF2KdfConfig.ITERATIONS.defaultValue
    );
  }

  /** Poll the `syncService` until a sync is completed */
  private pollUntilSynced() {
    const interval = setInterval(async () => {
      const lastSync = await this.syncService.getLastSync();
      if (lastSync !== null) {
        clearInterval(interval);
        this.syncCompleted$.next();
      }
    }, 200);
  }
}
