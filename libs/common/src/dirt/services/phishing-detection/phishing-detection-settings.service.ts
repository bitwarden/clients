import { combineLatest, Observable, of, switchMap } from "rxjs";
import { catchError, distinctUntilChanged, map, shareReplay, tap } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { PHISHING_DETECTION_DISK, StateProvider, UserKeyDefinition } from "../../../platform/state";
import { PhishingDetectionSettingsServiceAbstraction } from "../abstractions/phishing-detection-settings.service.abstraction";

const ENABLE_PHISHING_DETECTION = new UserKeyDefinition(
  PHISHING_DETECTION_DISK,
  "enablePhishingDetection",
  {
    deserializer: (value: boolean) => value ?? true, // Default: enabled
    clearOn: [],
  },
);

export class PhishingDetectionSettingsService implements PhishingDetectionSettingsServiceAbstraction {
  readonly available$: Observable<boolean>;
  readonly enabled$: Observable<boolean>;
  readonly on$: Observable<boolean>;

  constructor(
    private accountService: AccountService,
    private billingService: BillingAccountProfileStateService,
    private configService: ConfigService,
    private logService: LogService,
    private organizationService: OrganizationService,
    private platformService: PlatformUtilsService,
    private stateProvider: StateProvider,
  ) {
    this.logService.debug(`[PhishingDetectionSettingsService] Initializing service...`);
    this.available$ = this.buildAvailablePipeline$().pipe(
      distinctUntilChanged(),
      tap((available) =>
        this.logService.debug(
          `[PhishingDetectionSettingsService] Phishing detection available: ${available}`,
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.enabled$ = this.buildEnabledPipeline$().pipe(
      distinctUntilChanged(),
      tap((enabled) =>
        this.logService.debug(
          `[PhishingDetectionSettingsService] Phishing detection enabled: ${{ enabled }}`,
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.on$ = combineLatest([this.available$, this.enabled$]).pipe(
      map(([available, enabled]) => available && enabled),
      distinctUntilChanged(),
      tap((on) =>
        this.logService.debug(
          `[PhishingDetectionSettingsService] Phishing detection is on: ${{ on }}`,
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  async setEnabled(userId: UserId, enabled: boolean): Promise<void> {
    this.logService.debug(
      `[PhishingDetectionSettingsService] Setting phishing detection enabled: ${{ enabled, userId }}`,
    );
    await this.stateProvider.getUser(userId, ENABLE_PHISHING_DETECTION).update(() => enabled);
  }

  /**
   * Builds the observable pipeline to determine if phishing detection is available to the user
   *
   * @returns An observable pipeline that determines if phishing detection is available
   */
  private buildAvailablePipeline$(): Observable<boolean> {
    // Phishing detection is unavailable on Safari due to platform limitations.
    if (this.platformService.isSafari()) {
      this.logService.warning(
        `[PhishingDetectionSettingsService] Phishing detection is unavailable on Safari due to platform limitations`,
      );
      return of(false);
    }

    return combineLatest([
      this.accountService.activeAccount$,
      this.configService.getFeatureFlag$(FeatureFlag.PhishingDetection),
    ]).pipe(
      switchMap(([account, featureEnabled]) => {
        if (!account || !featureEnabled) {
          return of(false);
        }
        return combineLatest([
          this.billingService.hasPremiumPersonally$(account.id).pipe(catchError(() => of(false))),
          this.organizationService.organizations$(account.id).pipe(catchError(() => of([]))),
        ]).pipe(
          map(([hasPremium, organizations]) => hasPremium || this.orgGrantsAccess(organizations)),
          catchError(() => of(false)),
        );
      }),
    );
  }

  /**
   * Builds the observable pipeline to determine if phishing detection is enabled by the user
   *
   * @returns True if phishing detection is enabled for the active user
   */
  private buildEnabledPipeline$(): Observable<boolean> {
    return this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account) {
          return of(false);
        }
        this.logService.debug(
          `[PhishingDetectionSettingsService] Refreshing phishing detection enabled state`,
        );
        return this.stateProvider.getUserState$(ENABLE_PHISHING_DETECTION, account.id);
      }),
      map((enabled) => enabled ?? true),
    );
  }

  /**
   * Determines if any of the user's organizations grant access to phishing detection
   *
   * @param organizations The organizations the user is a member of
   * @returns True if any organization grants access to phishing detection
   */
  private orgGrantsAccess(organizations: Organization[]): boolean {
    return organizations.some((org) => {
      if (!org.canAccess || !org.isMember || !org.usersGetPremium) {
        return false;
      }
      return (
        org.productTierType === ProductTierType.Families ||
        (org.productTierType === ProductTierType.Enterprise && org.usePhishingBlocker)
      );
    });
  }
}
