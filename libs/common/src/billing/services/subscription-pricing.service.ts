import {
  combineLatest,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  take,
  throwError,
} from "rxjs";
import { catchError } from "rxjs/operators";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlanType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { PremiumPlanResponse } from "@bitwarden/common/billing/models/response/premium-plan.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/logging";

import { SubscriptionPricingServiceAbstraction } from "../abstractions/subscription-pricing.service.abstraction";
import {
  BusinessSubscriptionPricingTier,
  BusinessSubscriptionPricingTierIds,
  PersonalSubscriptionPricingTier,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "../types/subscription-pricing-tier";

export class DefaultSubscriptionPricingService implements SubscriptionPricingServiceAbstraction {
  /**
   * Fallback premium pricing used when the feature flag is disabled.
   * These values represent the legacy pricing model and will not reflect
   * server-side price changes. They are retained for backward compatibility
   * during the feature flag rollout period.
   */
  private static readonly FALLBACK_PREMIUM_SEAT_PRICE = 10;
  private static readonly FALLBACK_PREMIUM_STORAGE_PRICE = 4;

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private configService: ConfigService,
    private i18nService: I18nService,
    private logService: LogService,
  ) {}

  /**
   * Gets personal subscription pricing tiers (Premium and Families).
   * Throws any errors that occur during api request so callers must handle errors.
   * @returns An observable of an array of personal subscription pricing tiers.
   * @throws Error if any errors occur during api request.
   */
  getPersonalSubscriptionPricingTiers$ = (): Observable<PersonalSubscriptionPricingTier[]> =>
    combineLatest([this.premium$, this.families$]).pipe(
      catchError((error: unknown) => {
        this.logService.error("Failed to load personal subscription pricing tiers", error);
        return throwError(() => error);
      }),
    );

  /**
   * Gets business subscription pricing tiers (Teams, Enterprise, and Custom).
   * Throws any errors that occur during api request so callers must handle errors.
   * @returns An observable of an array of business subscription pricing tiers.
   * @throws Error if any errors occur during api request.
   */
  getBusinessSubscriptionPricingTiers$ = (): Observable<BusinessSubscriptionPricingTier[]> =>
    combineLatest([this.teams$, this.enterprise$, this.custom$]).pipe(
      catchError((error: unknown) => {
        this.logService.error("Failed to load business subscription pricing tiers", error);
        return throwError(() => error);
      }),
    );

  /**
   * Gets developer subscription pricing tiers (Free, Teams, and Enterprise).
   * Throws any errors that occur during api request so callers must handle errors.
   * @returns An observable of an array of business subscription pricing tiers for developers.
   * @throws Error if any errors occur during api request.
   */
  getDeveloperSubscriptionPricingTiers$ = (): Observable<BusinessSubscriptionPricingTier[]> =>
    combineLatest([this.free$, this.teams$, this.enterprise$]).pipe(
      catchError((error: unknown) => {
        this.logService.error("Failed to load developer subscription pricing tiers", error);
        return throwError(() => error);
      }),
    );

  private plansResponse$: Observable<ListResponse<PlanResponse>> = from(
    this.billingApiService.getPlans(),
  ).pipe(shareReplay({ bufferSize: 1, refCount: false }));

  private premiumPlanResponse$: Observable<PremiumPlanResponse> = from(
    this.billingApiService.getPremiumPlan(),
  ).pipe(
    catchError((error: unknown) => {
      this.logService.error("Failed to fetch premium plan from API", error);
      return throwError(() => error); // Re-throw to propagate to higher-level error handler
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private premium$: Observable<PersonalSubscriptionPricingTier> = this.configService
    .getFeatureFlag$(FeatureFlag.PM26793_FetchPremiumPriceFromPricingService)
    .pipe(
      take(1), // Lock behavior at first subscription to prevent switching data sources mid-stream
      switchMap((fetchPremiumFromPricingService) =>
        fetchPremiumFromPricingService
          ? this.premiumPlanResponse$.pipe(
              map((premiumPlan) => ({
                seat: premiumPlan.seat.price,
                storage: premiumPlan.storage.price,
              })),
            )
          : of({
              seat: DefaultSubscriptionPricingService.FALLBACK_PREMIUM_SEAT_PRICE,
              storage: DefaultSubscriptionPricingService.FALLBACK_PREMIUM_STORAGE_PRICE,
            }),
      ),
      map((premiumPrices) => ({
        id: PersonalSubscriptionPricingTierIds.Premium,
        name: this.i18nService.t("premium"),
        description: this.i18nService.t("planDescPremium"),
        availableCadences: [SubscriptionCadenceIds.Annually],
        passwordManager: {
          type: "standalone",
          annualPrice: premiumPrices.seat,
          annualPricePerAdditionalStorageGB: premiumPrices.storage,
          features: [
            this.featureTranslations.builtInAuthenticator(),
            this.featureTranslations.secureFileStorage(),
            this.featureTranslations.emergencyAccess(),
            this.featureTranslations.breachMonitoring(),
            this.featureTranslations.andMoreFeatures(),
          ],
        },
      })),
    );

  private families$: Observable<PersonalSubscriptionPricingTier> = this.plansResponse$.pipe(
    map((plans) => {
      const familiesPlan = plans.data.find((plan) => plan.type === PlanType.FamiliesAnnually)!;

      return {
        id: PersonalSubscriptionPricingTierIds.Families,
        name: this.i18nService.t("planNameFamilies"),
        description: this.i18nService.t("planDescFamiliesV2"),
        availableCadences: [SubscriptionCadenceIds.Annually],
        passwordManager: {
          type: "packaged",
          users: familiesPlan.PasswordManager.baseSeats,
          annualPrice: familiesPlan.PasswordManager.basePrice,
          annualPricePerAdditionalStorageGB:
            familiesPlan.PasswordManager.additionalStoragePricePerGb,
          features: [
            this.featureTranslations.premiumAccounts(),
            this.featureTranslations.familiesUnlimitedSharing(),
            this.featureTranslations.familiesUnlimitedCollections(),
            this.featureTranslations.familiesSharedStorage(),
          ],
        },
      };
    }),
  );

  private free$: Observable<BusinessSubscriptionPricingTier> = this.plansResponse$.pipe(
    map((plans): BusinessSubscriptionPricingTier => {
      const freePlan = plans.data.find((plan) => plan.type === PlanType.Free)!;

      return {
        id: BusinessSubscriptionPricingTierIds.Free,
        name: this.i18nService.t("planNameFree"),
        description: this.i18nService.t("planDescFreeV2", "1"),
        availableCadences: [],
        passwordManager: {
          type: "free",
          features: [
            this.featureTranslations.limitedUsersV2(freePlan.PasswordManager.maxSeats),
            this.featureTranslations.limitedCollectionsV2(freePlan.PasswordManager.maxCollections),
            this.featureTranslations.alwaysFree(),
          ],
        },
        secretsManager: {
          type: "free",
          features: [
            this.featureTranslations.twoSecretsIncluded(),
            this.featureTranslations.projectsIncludedV2(freePlan.SecretsManager.maxProjects),
          ],
        },
      };
    }),
  );

  private teams$: Observable<BusinessSubscriptionPricingTier> = this.plansResponse$.pipe(
    map((plans) => {
      const annualTeamsPlan = plans.data.find((plan) => plan.type === PlanType.TeamsAnnually)!;

      return {
        id: BusinessSubscriptionPricingTierIds.Teams,
        name: this.i18nService.t("planNameTeams"),
        description: this.i18nService.t("teamsPlanUpgradeMessage"),
        availableCadences: [SubscriptionCadenceIds.Annually, SubscriptionCadenceIds.Monthly],
        passwordManager: {
          type: "scalable",
          annualPricePerUser: annualTeamsPlan.PasswordManager.seatPrice,
          annualPricePerAdditionalStorageGB:
            annualTeamsPlan.PasswordManager.additionalStoragePricePerGb,
          features: [
            this.featureTranslations.secureItemSharing(),
            this.featureTranslations.eventLogMonitoring(),
            this.featureTranslations.directoryIntegration(),
            this.featureTranslations.scimSupport(),
          ],
        },
        secretsManager: {
          type: "scalable",
          annualPricePerUser: annualTeamsPlan.SecretsManager.seatPrice,
          annualPricePerAdditionalServiceAccount:
            annualTeamsPlan.SecretsManager.additionalPricePerServiceAccount,
          features: [
            this.featureTranslations.unlimitedSecretsAndProjects(),
            this.featureTranslations.includedMachineAccountsV2(
              annualTeamsPlan.SecretsManager.baseServiceAccount,
            ),
          ],
        },
      };
    }),
  );

  private enterprise$: Observable<BusinessSubscriptionPricingTier> = this.plansResponse$.pipe(
    map((plans) => {
      const annualEnterprisePlan = plans.data.find(
        (plan) => plan.type === PlanType.EnterpriseAnnually,
      )!;

      return {
        id: BusinessSubscriptionPricingTierIds.Enterprise,
        name: this.i18nService.t("planNameEnterprise"),
        description: this.i18nService.t("planDescEnterpriseV2"),
        availableCadences: [SubscriptionCadenceIds.Annually, SubscriptionCadenceIds.Monthly],
        passwordManager: {
          type: "scalable",
          annualPricePerUser: annualEnterprisePlan.PasswordManager.seatPrice,
          annualPricePerAdditionalStorageGB:
            annualEnterprisePlan.PasswordManager.additionalStoragePricePerGb,
          features: [
            this.featureTranslations.enterpriseSecurityPolicies(),
            this.featureTranslations.passwordLessSso(),
            this.featureTranslations.accountRecovery(),
            this.featureTranslations.selfHostOption(),
            this.featureTranslations.complimentaryFamiliesPlan(),
          ],
        },
        secretsManager: {
          type: "scalable",
          annualPricePerUser: annualEnterprisePlan.SecretsManager.seatPrice,
          annualPricePerAdditionalServiceAccount:
            annualEnterprisePlan.SecretsManager.additionalPricePerServiceAccount,
          features: [
            this.featureTranslations.unlimitedUsers(),
            this.featureTranslations.includedMachineAccountsV2(
              annualEnterprisePlan.SecretsManager.baseServiceAccount,
            ),
          ],
        },
      };
    }),
  );

  private custom$: Observable<BusinessSubscriptionPricingTier> = this.plansResponse$.pipe(
    map(
      (): BusinessSubscriptionPricingTier => ({
        id: BusinessSubscriptionPricingTierIds.Custom,
        name: this.i18nService.t("planNameCustom"),
        description: this.i18nService.t("planDescCustom"),
        availableCadences: [],
        passwordManager: {
          type: "custom",
          features: [
            this.featureTranslations.strengthenCybersecurity(),
            this.featureTranslations.boostProductivity(),
            this.featureTranslations.seamlessIntegration(),
          ],
        },
      }),
    ),
  );

  private featureTranslations = {
    builtInAuthenticator: () => ({
      key: "builtInAuthenticator",
      value: this.i18nService.t("builtInAuthenticator"),
    }),
    emergencyAccess: () => ({
      key: "emergencyAccess",
      value: this.i18nService.t("emergencyAccess"),
    }),
    breachMonitoring: () => ({
      key: "breachMonitoring",
      value: this.i18nService.t("breachMonitoring"),
    }),
    andMoreFeatures: () => ({
      key: "andMoreFeatures",
      value: this.i18nService.t("andMoreFeatures"),
    }),
    premiumAccounts: () => ({
      key: "premiumAccounts",
      value: this.i18nService.t("premiumAccounts"),
    }),
    secureFileStorage: () => ({
      key: "secureFileStorage",
      value: this.i18nService.t("secureFileStorage"),
    }),
    familiesUnlimitedSharing: () => ({
      key: "familiesUnlimitedSharing",
      value: this.i18nService.t("familiesUnlimitedSharing"),
    }),
    familiesUnlimitedCollections: () => ({
      key: "familiesUnlimitedCollections",
      value: this.i18nService.t("familiesUnlimitedCollections"),
    }),
    familiesSharedStorage: () => ({
      key: "familiesSharedStorage",
      value: this.i18nService.t("familiesSharedStorage"),
    }),
    limitedUsersV2: (users: number) => ({
      key: "limitedUsersV2",
      value: this.i18nService.t("limitedUsersV2", users),
    }),
    limitedCollectionsV2: (collections: number) => ({
      key: "limitedCollectionsV2",
      value: this.i18nService.t("limitedCollectionsV2", collections),
    }),
    alwaysFree: () => ({
      key: "alwaysFree",
      value: this.i18nService.t("alwaysFree"),
    }),
    twoSecretsIncluded: () => ({
      key: "twoSecretsIncluded",
      value: this.i18nService.t("twoSecretsIncluded"),
    }),
    projectsIncludedV2: (projects: number) => ({
      key: "projectsIncludedV2",
      value: this.i18nService.t("projectsIncludedV2", projects),
    }),
    secureItemSharing: () => ({
      key: "secureItemSharing",
      value: this.i18nService.t("secureItemSharing"),
    }),
    eventLogMonitoring: () => ({
      key: "eventLogMonitoring",
      value: this.i18nService.t("eventLogMonitoring"),
    }),
    directoryIntegration: () => ({
      key: "directoryIntegration",
      value: this.i18nService.t("directoryIntegration"),
    }),
    scimSupport: () => ({
      key: "scimSupport",
      value: this.i18nService.t("scimSupport"),
    }),
    unlimitedSecretsAndProjects: () => ({
      key: "unlimitedSecretsAndProjects",
      value: this.i18nService.t("unlimitedSecretsAndProjects"),
    }),
    includedMachineAccountsV2: (included: number) => ({
      key: "includedMachineAccountsV2",
      value: this.i18nService.t("includedMachineAccountsV2", included),
    }),
    enterpriseSecurityPolicies: () => ({
      key: "enterpriseSecurityPolicies",
      value: this.i18nService.t("enterpriseSecurityPolicies"),
    }),
    passwordLessSso: () => ({
      key: "passwordLessSso",
      value: this.i18nService.t("passwordLessSso"),
    }),
    accountRecovery: () => ({
      key: "accountRecovery",
      value: this.i18nService.t("accountRecovery"),
    }),
    selfHostOption: () => ({
      key: "selfHostOption",
      value: this.i18nService.t("selfHostOption"),
    }),
    complimentaryFamiliesPlan: () => ({
      key: "complimentaryFamiliesPlan",
      value: this.i18nService.t("complimentaryFamiliesPlan"),
    }),
    unlimitedUsers: () => ({
      key: "unlimitedUsers",
      value: this.i18nService.t("unlimitedUsers"),
    }),
    strengthenCybersecurity: () => ({
      key: "strengthenCybersecurity",
      value: this.i18nService.t("strengthenCybersecurity"),
    }),
    boostProductivity: () => ({
      key: "boostProductivity",
      value: this.i18nService.t("boostProductivity"),
    }),
    seamlessIntegration: () => ({
      key: "seamlessIntegration",
      value: this.i18nService.t("seamlessIntegration"),
    }),
  };
}
