import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlanType, ProductTierType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { PremiumPlanResponse } from "@bitwarden/common/billing/models/response/premium-plan.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/logging";

import {
  BusinessSubscriptionPricingTierIds,
  PersonalSubscriptionPricingTierIds,
  SubscriptionCadenceIds,
} from "../types/subscription-pricing-tier";

import { DefaultSubscriptionPricingService } from "./subscription-pricing.service";

describe("DefaultSubscriptionPricingService", () => {
  let service: DefaultSubscriptionPricingService;
  let billingApiService: MockProxy<BillingApiServiceAbstraction>;
  let configService: MockProxy<ConfigService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;
  let environmentService: MockProxy<EnvironmentService>;

  const mockFamiliesPlan = {
    type: PlanType.FamiliesAnnually2025,
    productTier: ProductTierType.Families,
    name: "Families (Annually)",
    isAnnual: true,
    nameLocalizationKey: "planNameFamilies",
    descriptionLocalizationKey: "planDescFamiliesV2",
    canBeUsedByBusiness: false,
    trialPeriodDays: 7,
    hasSelfHost: false,
    hasPolicies: false,
    hasMyItems: false,
    hasGroups: false,
    hasDirectory: false,
    hasEvents: false,
    hasTotp: true,
    has2fa: true,
    hasApi: true,
    hasSso: false,
    hasResetPassword: false,
    hasSend: true,
    usersGetPremium: true,
    upgradeSortOrder: 1,
    displaySortOrder: 1,
    legacyYear: 2024,
    disabled: false,
    PasswordManager: {
      baseSeats: 6,
      baseStorageGb: 1,
      basePrice: 36,
      seatPrice: 0,
      additionalStoragePricePerGb: 4,
      providedStorageGB: 1,
      allowSeatAutoscale: false,
      maxSeats: 6,
      maxCollections: null,
      maxProjects: null,
    },
    SecretsManager: null,
  } as any as PlanResponse;

  const mockTeamsPlan = {
    type: PlanType.TeamsAnnually,
    productTier: ProductTierType.Teams,
    name: "Teams (Annually)",
    isAnnual: true,
    nameLocalizationKey: "planNameTeams",
    descriptionLocalizationKey: "planDescTeams",
    canBeUsedByBusiness: true,
    trialPeriodDays: 7,
    hasSelfHost: true,
    hasPolicies: true,
    hasMyItems: false,
    hasGroups: true,
    hasDirectory: true,
    hasEvents: true,
    hasTotp: true,
    has2fa: true,
    hasApi: true,
    hasSso: true,
    hasResetPassword: true,
    hasSend: true,
    usersGetPremium: false,
    upgradeSortOrder: 2,
    displaySortOrder: 2,
    legacyYear: 2024,
    disabled: false,
    PasswordManager: {
      baseSeats: 0,
      baseStorageGb: 1,
      basePrice: 0,
      seatPrice: 36,
      additionalStoragePricePerGb: 4,
      providedStorageGB: 1,
      allowSeatAutoscale: true,
      maxSeats: null,
      maxCollections: null,
      maxProjects: null,
    },
    SecretsManager: {
      baseSeats: 0,
      baseStorageGb: 0,
      basePrice: 0,
      seatPrice: 72,
      additionalPricePerServiceAccount: 6,
      baseServiceAccount: 20,
      allowSeatAutoscale: true,
      maxSeats: null,
      maxCollections: null,
      maxProjects: null,
    },
  } as any as PlanResponse;

  const mockEnterprisePlan = {
    type: PlanType.EnterpriseAnnually,
    productTier: ProductTierType.Enterprise,
    name: "Enterprise (Annually)",
    isAnnual: true,
    nameLocalizationKey: "planNameEnterprise",
    descriptionLocalizationKey: "planDescEnterpriseV2",
    canBeUsedByBusiness: true,
    trialPeriodDays: 7,
    hasSelfHost: true,
    hasPolicies: true,
    hasMyItems: true,
    hasGroups: true,
    hasDirectory: true,
    hasEvents: true,
    hasTotp: true,
    has2fa: true,
    hasApi: true,
    hasSso: true,
    hasResetPassword: true,
    hasSend: true,
    usersGetPremium: false,
    upgradeSortOrder: 3,
    displaySortOrder: 3,
    legacyYear: 2024,
    disabled: false,
    PasswordManager: {
      baseSeats: 0,
      baseStorageGb: 1,
      basePrice: 0,
      seatPrice: 48,
      additionalStoragePricePerGb: 4,
      allowSeatAutoscale: true,
      maxSeats: null,
      maxCollections: null,
      maxProjects: null,
    },
    SecretsManager: {
      baseSeats: 0,
      baseStorageGb: 0,
      basePrice: 0,
      seatPrice: 84,
      additionalPricePerServiceAccount: 6,
      baseServiceAccount: 50,
      allowSeatAutoscale: true,
      maxSeats: null,
      maxCollections: null,
      maxProjects: null,
    },
  } as any as PlanResponse;

  const mockFreePlan = {
    type: PlanType.Free,
    productTier: ProductTierType.Free,
    name: "Free",
    isAnnual: false,
    nameLocalizationKey: "planNameFree",
    descriptionLocalizationKey: "planDescFreeV2",
    canBeUsedByBusiness: true,
    trialPeriodDays: null,
    hasSelfHost: false,
    hasPolicies: false,
    hasMyItems: false,
    hasGroups: false,
    hasDirectory: false,
    hasEvents: false,
    hasTotp: false,
    has2fa: true,
    hasApi: false,
    hasSso: false,
    hasResetPassword: false,
    hasSend: true,
    usersGetPremium: false,
    upgradeSortOrder: 0,
    displaySortOrder: 0,
    legacyYear: 2024,
    disabled: false,
    PasswordManager: {
      baseSeats: 2,
      baseStorageGb: null,
      basePrice: 0,
      seatPrice: 0,
      additionalStoragePricePerGb: null,
      allowSeatAutoscale: false,
      maxSeats: 2,
      maxCollections: 2,
      maxProjects: null,
    },
    SecretsManager: {
      baseSeats: 2,
      baseStorageGb: null,
      basePrice: 0,
      seatPrice: 0,
      additionalPricePerServiceAccount: null,
      baseServiceAccount: 0,
      allowSeatAutoscale: false,
      maxSeats: 2,
      maxCollections: null,
      maxProjects: 3,
    },
  } as any as PlanResponse;

  const mockPlansResponse: any = {
    data: [mockFamiliesPlan, mockTeamsPlan, mockEnterprisePlan, mockFreePlan],
    continuationToken: null,
  };

  const mockPremiumPlanResponse: PremiumPlanResponse = {
    seat: {
      price: 10,
    },
    storage: {
      price: 4,
      provided: 1,
    },
  } as PremiumPlanResponse;

  beforeAll(() => {
    i18nService = mock<I18nService>();
    logService = mock<LogService>();

    i18nService.t.mockImplementation((key: string, ...args: any[]) => {
      switch (key) {
        // Plan names
        case "premium":
          return "Premium";
        case "planNameFamilies":
          return "Families";
        case "planNameTeams":
          return "Teams";
        case "planNameEnterprise":
          return "Enterprise";
        case "planNameFree":
          return "Free";
        case "planNameCustom":
          return "Custom";

        // Plan descriptions
        case "advancedOnlineSecurity":
          return "Premium plan description";
        case "planDescFamiliesV2":
          return "Families plan description";
        case "planDescFreeV2":
          return `Free plan for ${args[0]} user`;
        case "planDescEnterpriseV2":
          return "Enterprise plan description";
        case "planDescCustom":
          return "Custom plan description";
        case "teamsPlanUpgradeMessage":
          return "Resilient protection for growing teams";

        // Feature translations
        case "builtInAuthenticator":
          return "Built-in authenticator";
        case "secureFileStorage":
          return "Secure file storage";
        case "emergencyAccess":
          return "Emergency access";
        case "breachMonitoring":
          return "Breach monitoring";
        case "andMoreFeatures":
          return "And more features";
        case "premiumAccounts":
          return "6 premium accounts";
        case "familiesUnlimitedSharing":
          return "Unlimited sharing for families";
        case "familiesUnlimitedCollections":
          return "Unlimited collections for families";
        case "familiesSharedStorage":
          return "Shared storage for families";
        case "limitedUsersV2":
          return `Limited to ${args[0]} users`;
        case "limitedCollectionsV2":
          return `Limited to ${args[0]} collections`;
        case "alwaysFree":
          return "Always free";
        case "twoSecretsIncluded":
          return "Two secrets included";
        case "projectsIncludedV2":
          return `${args[0]} projects included`;
        case "secureItemSharing":
          return "Secure item sharing";
        case "eventLogMonitoring":
          return "Event log monitoring";
        case "directoryIntegration":
          return "Directory integration";
        case "scimSupport":
          return "SCIM support";
        case "unlimitedSecretsAndProjects":
          return "Unlimited secrets and projects";
        case "includedMachineAccountsV2":
          return `${args[0]} machine accounts included`;
        case "enterpriseSecurityPolicies":
          return "Enterprise security policies";
        case "passwordLessSso":
          return "Passwordless SSO";
        case "accountRecovery":
          return "Account recovery";
        case "selfHostOption":
          return "Self-host option";
        case "complimentaryFamiliesPlan":
          return "Complimentary families plan";
        case "unlimitedUsers":
          return "Unlimited users";
        case "strengthenCybersecurity":
          return "Strengthen cybersecurity";
        case "boostProductivity":
          return "Boost productivity";
        case "seamlessIntegration":
          return "Seamless integration";
        default:
          return key;
      }
    });
  });

  const setupEnvironmentService = (
    envService: MockProxy<EnvironmentService>,
    region: Region = Region.US,
  ) => {
    envService.environment$ = of({
      getRegion: () => region,
      isCloud: () => region !== Region.SelfHosted,
    } as any);
  };

  beforeEach(() => {
    billingApiService = mock<BillingApiServiceAbstraction>();
    configService = mock<ConfigService>();
    environmentService = mock<EnvironmentService>();

    billingApiService.getPlans.mockResolvedValue(mockPlansResponse);
    billingApiService.getPremiumPlan.mockResolvedValue(mockPremiumPlanResponse);
    configService.getFeatureFlag$.mockReturnValue(of(false));
    setupEnvironmentService(environmentService);

    service = new DefaultSubscriptionPricingService(
      billingApiService,
      configService,
      i18nService,
      logService,
      environmentService,
    );
  });

  describe("getPersonalSubscriptionPricingTiers$", () => {
    it("should return Premium and Families pricing tiers with correct structure", (done) => {
      service.getPersonalSubscriptionPricingTiers$().subscribe((tiers) => {
        expect(tiers).toHaveLength(2);

        const premiumTier = tiers.find(
          (tier) => tier.id === PersonalSubscriptionPricingTierIds.Premium,
        );
        expect(premiumTier).toEqual({
          id: PersonalSubscriptionPricingTierIds.Premium,
          name: "Premium",
          description: "Premium plan description",
          availableCadences: [SubscriptionCadenceIds.Annually],
          passwordManager: {
            type: "standalone",
            annualPrice: 10,
            annualPricePerAdditionalStorageGB: 4,
            providedStorageGB: 1,
            features: [
              { key: "builtInAuthenticator", value: "Built-in authenticator" },
              { key: "secureFileStorage", value: "Secure file storage" },
              { key: "emergencyAccess", value: "Emergency access" },
              { key: "breachMonitoring", value: "Breach monitoring" },
              { key: "andMoreFeatures", value: "And more features" },
            ],
          },
        });

        const familiesTier = tiers.find(
          (tier) => tier.id === PersonalSubscriptionPricingTierIds.Families,
        );
        expect(familiesTier).toEqual({
          id: PersonalSubscriptionPricingTierIds.Families,
          name: "Families",
          description: "Families plan description",
          availableCadences: [SubscriptionCadenceIds.Annually],
          passwordManager: {
            type: "packaged",
            users: mockFamiliesPlan.PasswordManager.baseSeats,
            annualPrice: mockFamiliesPlan.PasswordManager.basePrice,
            annualPricePerAdditionalStorageGB:
              mockFamiliesPlan.PasswordManager.additionalStoragePricePerGb,
            providedStorageGB: mockFamiliesPlan.PasswordManager.baseStorageGb,
            features: [
              { key: "premiumAccounts", value: "6 premium accounts" },
              { key: "familiesUnlimitedSharing", value: "Unlimited sharing for families" },
              { key: "familiesUnlimitedCollections", value: "Unlimited collections for families" },
              { key: "familiesSharedStorage", value: "Shared storage for families" },
            ],
          },
        });

        expect(i18nService.t).toHaveBeenCalledWith("premium");
        expect(i18nService.t).toHaveBeenCalledWith("advancedOnlineSecurity");
        expect(i18nService.t).toHaveBeenCalledWith("planNameFamilies");
        expect(i18nService.t).toHaveBeenCalledWith("planDescFamiliesV2");
        expect(i18nService.t).toHaveBeenCalledWith("builtInAuthenticator");
        expect(i18nService.t).toHaveBeenCalledWith("secureFileStorage");
        expect(i18nService.t).toHaveBeenCalledWith("emergencyAccess");
        expect(i18nService.t).toHaveBeenCalledWith("breachMonitoring");
        expect(i18nService.t).toHaveBeenCalledWith("andMoreFeatures");
        expect(i18nService.t).toHaveBeenCalledWith("premiumAccounts");
        expect(i18nService.t).toHaveBeenCalledWith("familiesUnlimitedSharing");
        expect(i18nService.t).toHaveBeenCalledWith("familiesUnlimitedCollections");
        expect(i18nService.t).toHaveBeenCalledWith("familiesSharedStorage");

        done();
      });
    });

    it("should handle API errors by logging and throwing error", (done) => {
      const errorBillingApiService = mock<BillingApiServiceAbstraction>();
      const errorConfigService = mock<ConfigService>();
      const errorI18nService = mock<I18nService>();
      const errorLogService = mock<LogService>();
      const errorEnvironmentService = mock<EnvironmentService>();

      const testError = new Error("API error");
      errorBillingApiService.getPlans.mockRejectedValue(testError);
      errorBillingApiService.getPremiumPlan.mockResolvedValue(mockPremiumPlanResponse);
      errorConfigService.getFeatureFlag$.mockReturnValue(of(false));
      setupEnvironmentService(errorEnvironmentService);

      errorI18nService.t.mockImplementation((key: string) => key);

      const errorService = new DefaultSubscriptionPricingService(
        errorBillingApiService,
        errorConfigService,
        errorI18nService,
        errorLogService,
        errorEnvironmentService,
      );

      errorService.getPersonalSubscriptionPricingTiers$().subscribe({
        next: () => {
          fail("Observable should error, not return a value");
        },
        error: (error: unknown) => {
          expect(errorLogService.error).toHaveBeenCalledWith(
            "Failed to load personal subscription pricing tiers",
            testError,
          );
          expect(error).toBe(testError);
          done();
        },
      });
    });

    it("should contain correct pricing", (done) => {
      service.getPersonalSubscriptionPricingTiers$().subscribe((tiers) => {
        const premiumTier = tiers.find(
          (tier) => tier.id === PersonalSubscriptionPricingTierIds.Premium,
        )!;
        const familiesTier = tiers.find(
          (tier) => tier.id === PersonalSubscriptionPricingTierIds.Families,
        )!;

        expect(premiumTier.passwordManager.annualPrice).toEqual(10);
        expect(premiumTier.passwordManager.annualPricePerAdditionalStorageGB).toEqual(4);
        expect(premiumTier.passwordManager.providedStorageGB).toEqual(1);

        expect(familiesTier.passwordManager.annualPrice).toEqual(
          mockFamiliesPlan.PasswordManager.basePrice,
        );
        expect(familiesTier.passwordManager.annualPricePerAdditionalStorageGB).toEqual(
          mockFamiliesPlan.PasswordManager.additionalStoragePricePerGb,
        );
        expect(familiesTier.passwordManager.providedStorageGB).toEqual(
          mockFamiliesPlan.PasswordManager.baseStorageGb,
        );

        done();
      });
    });
  });

  describe("getBusinessSubscriptionPricingTiers$", () => {
    it("should return Teams, Enterprise, and Custom pricing tiers with correct structure", (done) => {
      service.getBusinessSubscriptionPricingTiers$().subscribe((tiers) => {
        expect(tiers).toHaveLength(3);

        const teamsTier = tiers.find(
          (tier) => tier.id === BusinessSubscriptionPricingTierIds.Teams,
        );
        expect(teamsTier).toEqual({
          id: BusinessSubscriptionPricingTierIds.Teams,
          name: "Teams",
          description: "Resilient protection for growing teams",
          availableCadences: [SubscriptionCadenceIds.Annually, SubscriptionCadenceIds.Monthly],
          passwordManager: {
            type: "scalable",
            annualPricePerUser: mockTeamsPlan.PasswordManager.seatPrice,
            annualPricePerAdditionalStorageGB:
              mockTeamsPlan.PasswordManager.additionalStoragePricePerGb,
            providedStorageGB: mockTeamsPlan.PasswordManager.baseStorageGb,
            features: [
              { key: "secureItemSharing", value: "Secure item sharing" },
              { key: "eventLogMonitoring", value: "Event log monitoring" },
              { key: "directoryIntegration", value: "Directory integration" },
              { key: "scimSupport", value: "SCIM support" },
            ],
          },
          secretsManager: {
            type: "scalable",
            annualPricePerUser: mockTeamsPlan.SecretsManager!.seatPrice,
            annualPricePerAdditionalServiceAccount:
              mockTeamsPlan.SecretsManager!.additionalPricePerServiceAccount,
            features: [
              { key: "unlimitedSecretsAndProjects", value: "Unlimited secrets and projects" },
              {
                key: "includedMachineAccountsV2",
                value: `${mockTeamsPlan.SecretsManager!.baseServiceAccount} machine accounts included`,
              },
            ],
          },
        });

        const enterpriseTier = tiers.find(
          (tier) => tier.id === BusinessSubscriptionPricingTierIds.Enterprise,
        );
        expect(enterpriseTier).toEqual({
          id: BusinessSubscriptionPricingTierIds.Enterprise,
          name: "Enterprise",
          description: "Enterprise plan description",
          availableCadences: [SubscriptionCadenceIds.Annually, SubscriptionCadenceIds.Monthly],
          passwordManager: {
            type: "scalable",
            annualPricePerUser: mockEnterprisePlan.PasswordManager.seatPrice,
            annualPricePerAdditionalStorageGB:
              mockEnterprisePlan.PasswordManager.additionalStoragePricePerGb,
            providedStorageGB: mockEnterprisePlan.PasswordManager.baseStorageGb,
            features: [
              { key: "enterpriseSecurityPolicies", value: "Enterprise security policies" },
              { key: "passwordLessSso", value: "Passwordless SSO" },
              { key: "accountRecovery", value: "Account recovery" },
              { key: "selfHostOption", value: "Self-host option" },
              { key: "complimentaryFamiliesPlan", value: "Complimentary families plan" },
            ],
          },
          secretsManager: {
            type: "scalable",
            annualPricePerUser: mockEnterprisePlan.SecretsManager!.seatPrice,
            annualPricePerAdditionalServiceAccount:
              mockEnterprisePlan.SecretsManager!.additionalPricePerServiceAccount,
            features: [
              { key: "unlimitedUsers", value: "Unlimited users" },
              {
                key: "includedMachineAccountsV2",
                value: `${mockEnterprisePlan.SecretsManager!.baseServiceAccount} machine accounts included`,
              },
            ],
          },
        });

        const customTier = tiers.find(
          (tier) => tier.id === BusinessSubscriptionPricingTierIds.Custom,
        );
        expect(customTier).toEqual({
          id: BusinessSubscriptionPricingTierIds.Custom,
          name: "Custom",
          description: "Custom plan description",
          availableCadences: [],
          passwordManager: {
            type: "custom",
            features: [
              { key: "strengthenCybersecurity", value: "Strengthen cybersecurity" },
              { key: "boostProductivity", value: "Boost productivity" },
              { key: "seamlessIntegration", value: "Seamless integration" },
            ],
          },
        });

        expect(i18nService.t).toHaveBeenCalledWith("planNameTeams");
        expect(i18nService.t).toHaveBeenCalledWith("teamsPlanUpgradeMessage");
        expect(i18nService.t).toHaveBeenCalledWith("planNameEnterprise");
        expect(i18nService.t).toHaveBeenCalledWith("planDescEnterpriseV2");
        expect(i18nService.t).toHaveBeenCalledWith("planNameCustom");
        expect(i18nService.t).toHaveBeenCalledWith("planDescCustom");
        expect(i18nService.t).toHaveBeenCalledWith("secureItemSharing");
        expect(i18nService.t).toHaveBeenCalledWith("eventLogMonitoring");
        expect(i18nService.t).toHaveBeenCalledWith("directoryIntegration");
        expect(i18nService.t).toHaveBeenCalledWith("scimSupport");
        expect(i18nService.t).toHaveBeenCalledWith("unlimitedSecretsAndProjects");
        expect(i18nService.t).toHaveBeenCalledWith("includedMachineAccountsV2", 20);
        expect(i18nService.t).toHaveBeenCalledWith("enterpriseSecurityPolicies");
        expect(i18nService.t).toHaveBeenCalledWith("passwordLessSso");
        expect(i18nService.t).toHaveBeenCalledWith("accountRecovery");
        expect(i18nService.t).toHaveBeenCalledWith("selfHostOption");
        expect(i18nService.t).toHaveBeenCalledWith("complimentaryFamiliesPlan");
        expect(i18nService.t).toHaveBeenCalledWith("unlimitedUsers");
        expect(i18nService.t).toHaveBeenCalledWith("includedMachineAccountsV2", 50);
        expect(i18nService.t).toHaveBeenCalledWith("strengthenCybersecurity");
        expect(i18nService.t).toHaveBeenCalledWith("boostProductivity");
        expect(i18nService.t).toHaveBeenCalledWith("seamlessIntegration");

        done();
      });
    });

    it("should handle API errors by logging and throwing error", (done) => {
      const errorBillingApiService = mock<BillingApiServiceAbstraction>();
      const errorConfigService = mock<ConfigService>();
      const errorI18nService = mock<I18nService>();
      const errorLogService = mock<LogService>();
      const errorEnvironmentService = mock<EnvironmentService>();

      const testError = new Error("API error");
      errorBillingApiService.getPlans.mockRejectedValue(testError);
      errorBillingApiService.getPremiumPlan.mockResolvedValue(mockPremiumPlanResponse);
      errorConfigService.getFeatureFlag$.mockReturnValue(of(false));
      setupEnvironmentService(errorEnvironmentService);

      errorI18nService.t.mockImplementation((key: string) => key);

      const errorService = new DefaultSubscriptionPricingService(
        errorBillingApiService,
        errorConfigService,
        errorI18nService,
        errorLogService,
        errorEnvironmentService,
      );

      errorService.getBusinessSubscriptionPricingTiers$().subscribe({
        next: () => {
          fail("Observable should error, not return a value");
        },
        error: (error: unknown) => {
          expect(errorLogService.error).toHaveBeenCalledWith(
            "Failed to load business subscription pricing tiers",
            testError,
          );
          expect(error).toBe(testError);
          done();
        },
      });
    });

    it("should contain correct pricing", (done) => {
      service.getBusinessSubscriptionPricingTiers$().subscribe((tiers) => {
        const teamsTier = tiers.find(
          (tier) => tier.id === BusinessSubscriptionPricingTierIds.Teams,
        )!;
        const enterpriseTier = tiers.find(
          (tier) => tier.id === BusinessSubscriptionPricingTierIds.Enterprise,
        )!;

        const teamsPasswordManager = teamsTier.passwordManager as any;
        const teamsSecretsManager = teamsTier.secretsManager as any;
        expect(teamsPasswordManager.annualPricePerUser).toEqual(
          mockTeamsPlan.PasswordManager.seatPrice,
        );
        expect(teamsPasswordManager.annualPricePerAdditionalStorageGB).toEqual(
          mockTeamsPlan.PasswordManager.additionalStoragePricePerGb,
        );
        expect(teamsSecretsManager.annualPricePerUser).toEqual(
          mockTeamsPlan.SecretsManager.seatPrice,
        );
        expect(teamsSecretsManager.annualPricePerAdditionalServiceAccount).toEqual(
          mockTeamsPlan.SecretsManager.additionalPricePerServiceAccount,
        );
        expect(teamsPasswordManager.providedStorageGB).toEqual(
          mockTeamsPlan.PasswordManager.baseStorageGb,
        );

        const enterprisePasswordManager = enterpriseTier.passwordManager as any;
        const enterpriseSecretsManager = enterpriseTier.secretsManager as any;
        expect(enterprisePasswordManager.annualPricePerUser).toEqual(
          mockEnterprisePlan.PasswordManager.seatPrice,
        );
        expect(enterprisePasswordManager.annualPricePerAdditionalStorageGB).toEqual(
          mockEnterprisePlan.PasswordManager.additionalStoragePricePerGb,
        );
        expect(enterprisePasswordManager.providedStorageGB).toEqual(
          mockEnterprisePlan.PasswordManager.baseStorageGb,
        );
        expect(enterpriseSecretsManager.annualPricePerUser).toEqual(
          mockEnterprisePlan.SecretsManager.seatPrice,
        );
        expect(enterpriseSecretsManager.annualPricePerAdditionalServiceAccount).toEqual(
          mockEnterprisePlan.SecretsManager.additionalPricePerServiceAccount,
        );

        done();
      });
    });

    it("should not include secretsManager for Custom tier", (done) => {
      service.getBusinessSubscriptionPricingTiers$().subscribe((tiers) => {
        const customTier = tiers.find(
          (tier) => tier.id === BusinessSubscriptionPricingTierIds.Custom,
        )!;
        expect(customTier.secretsManager).toBeUndefined();
        done();
      });
    });
  });

  describe("getDeveloperSubscriptionPricingTiers$", () => {
    it("should return Free, Teams, and Enterprise pricing tiers with correct structure", (done) => {
      service.getDeveloperSubscriptionPricingTiers$().subscribe((tiers) => {
        expect(tiers).toHaveLength(3);

        const freeTier = tiers.find((tier) => tier.id === BusinessSubscriptionPricingTierIds.Free);
        expect(freeTier).toEqual({
          id: BusinessSubscriptionPricingTierIds.Free,
          name: "Free",
          description: "Free plan for 1 user",
          availableCadences: [],
          passwordManager: {
            type: "free",
            features: [
              {
                key: "limitedUsersV2",
                value: `Limited to ${mockFreePlan.PasswordManager.maxSeats} users`,
              },
              {
                key: "limitedCollectionsV2",
                value: `Limited to ${mockFreePlan.PasswordManager.maxCollections} collections`,
              },
              { key: "alwaysFree", value: "Always free" },
            ],
          },
          secretsManager: {
            type: "free",
            features: [
              { key: "twoSecretsIncluded", value: "Two secrets included" },
              {
                key: "projectsIncludedV2",
                value: `${mockFreePlan.SecretsManager!.maxProjects} projects included`,
              },
            ],
          },
        });

        const teamsTier = tiers.find(
          (tier) => tier.id === BusinessSubscriptionPricingTierIds.Teams,
        );
        expect(teamsTier).toEqual({
          id: BusinessSubscriptionPricingTierIds.Teams,
          name: "Teams",
          description: "Resilient protection for growing teams",
          availableCadences: [SubscriptionCadenceIds.Annually, SubscriptionCadenceIds.Monthly],
          passwordManager: {
            type: "scalable",
            annualPricePerUser: mockTeamsPlan.PasswordManager.seatPrice,
            annualPricePerAdditionalStorageGB:
              mockTeamsPlan.PasswordManager.additionalStoragePricePerGb,
            providedStorageGB: mockTeamsPlan.PasswordManager.baseStorageGb,
            features: [
              { key: "secureItemSharing", value: "Secure item sharing" },
              { key: "eventLogMonitoring", value: "Event log monitoring" },
              { key: "directoryIntegration", value: "Directory integration" },
              { key: "scimSupport", value: "SCIM support" },
            ],
          },
          secretsManager: {
            type: "scalable",
            annualPricePerUser: mockTeamsPlan.SecretsManager!.seatPrice,
            annualPricePerAdditionalServiceAccount:
              mockTeamsPlan.SecretsManager!.additionalPricePerServiceAccount,
            features: [
              { key: "unlimitedSecretsAndProjects", value: "Unlimited secrets and projects" },
              {
                key: "includedMachineAccountsV2",
                value: `${mockTeamsPlan.SecretsManager!.baseServiceAccount} machine accounts included`,
              },
            ],
          },
        });

        const enterpriseTier = tiers.find(
          (tier) => tier.id === BusinessSubscriptionPricingTierIds.Enterprise,
        );
        expect(enterpriseTier).toEqual({
          id: BusinessSubscriptionPricingTierIds.Enterprise,
          name: "Enterprise",
          description: "Enterprise plan description",
          availableCadences: [SubscriptionCadenceIds.Annually, SubscriptionCadenceIds.Monthly],
          passwordManager: {
            type: "scalable",
            annualPricePerUser: mockEnterprisePlan.PasswordManager.seatPrice,
            annualPricePerAdditionalStorageGB:
              mockEnterprisePlan.PasswordManager.additionalStoragePricePerGb,
            providedStorageGB: mockEnterprisePlan.PasswordManager.baseStorageGb,
            features: [
              { key: "enterpriseSecurityPolicies", value: "Enterprise security policies" },
              { key: "passwordLessSso", value: "Passwordless SSO" },
              { key: "accountRecovery", value: "Account recovery" },
              { key: "selfHostOption", value: "Self-host option" },
              { key: "complimentaryFamiliesPlan", value: "Complimentary families plan" },
            ],
          },
          secretsManager: {
            type: "scalable",
            annualPricePerUser: mockEnterprisePlan.SecretsManager!.seatPrice,
            annualPricePerAdditionalServiceAccount:
              mockEnterprisePlan.SecretsManager!.additionalPricePerServiceAccount,
            features: [
              { key: "unlimitedUsers", value: "Unlimited users" },
              {
                key: "includedMachineAccountsV2",
                value: `${mockEnterprisePlan.SecretsManager!.baseServiceAccount} machine accounts included`,
              },
            ],
          },
        });

        expect(i18nService.t).toHaveBeenCalledWith("planNameFree");
        expect(i18nService.t).toHaveBeenCalledWith("planDescFreeV2", "1");
        expect(i18nService.t).toHaveBeenCalledWith(
          "limitedUsersV2",
          mockFreePlan.PasswordManager.maxSeats,
        );
        expect(i18nService.t).toHaveBeenCalledWith(
          "limitedCollectionsV2",
          mockFreePlan.PasswordManager.maxCollections,
        );
        expect(i18nService.t).toHaveBeenCalledWith("alwaysFree");
        expect(i18nService.t).toHaveBeenCalledWith("twoSecretsIncluded");
        expect(i18nService.t).toHaveBeenCalledWith(
          "projectsIncludedV2",
          mockFreePlan.SecretsManager!.maxProjects,
        );
        expect(i18nService.t).toHaveBeenCalledWith("planNameTeams");
        expect(i18nService.t).toHaveBeenCalledWith("teamsPlanUpgradeMessage");
        expect(i18nService.t).toHaveBeenCalledWith("planNameEnterprise");
        expect(i18nService.t).toHaveBeenCalledWith("planDescEnterpriseV2");
        expect(i18nService.t).toHaveBeenCalledWith("secureItemSharing");
        expect(i18nService.t).toHaveBeenCalledWith("eventLogMonitoring");
        expect(i18nService.t).toHaveBeenCalledWith("directoryIntegration");
        expect(i18nService.t).toHaveBeenCalledWith("scimSupport");
        expect(i18nService.t).toHaveBeenCalledWith("unlimitedSecretsAndProjects");
        expect(i18nService.t).toHaveBeenCalledWith("includedMachineAccountsV2", 20);
        expect(i18nService.t).toHaveBeenCalledWith("enterpriseSecurityPolicies");
        expect(i18nService.t).toHaveBeenCalledWith("passwordLessSso");
        expect(i18nService.t).toHaveBeenCalledWith("accountRecovery");
        expect(i18nService.t).toHaveBeenCalledWith("selfHostOption");
        expect(i18nService.t).toHaveBeenCalledWith("complimentaryFamiliesPlan");
        expect(i18nService.t).toHaveBeenCalledWith("unlimitedUsers");
        expect(i18nService.t).toHaveBeenCalledWith("includedMachineAccountsV2", 50);

        done();
      });
    });

    it("should handle API errors by logging and throwing error", (done) => {
      const errorBillingApiService = mock<BillingApiServiceAbstraction>();
      const errorConfigService = mock<ConfigService>();
      const errorI18nService = mock<I18nService>();
      const errorLogService = mock<LogService>();
      const errorEnvironmentService = mock<EnvironmentService>();

      const testError = new Error("API error");
      errorBillingApiService.getPlans.mockRejectedValue(testError);
      errorBillingApiService.getPremiumPlan.mockResolvedValue(mockPremiumPlanResponse);
      errorConfigService.getFeatureFlag$.mockReturnValue(of(false));
      setupEnvironmentService(errorEnvironmentService);

      errorI18nService.t.mockImplementation((key: string) => key);

      const errorService = new DefaultSubscriptionPricingService(
        errorBillingApiService,
        errorConfigService,
        errorI18nService,
        errorLogService,
        errorEnvironmentService,
      );

      errorService.getDeveloperSubscriptionPricingTiers$().subscribe({
        next: () => {
          fail("Observable should error, not return a value");
        },
        error: (error: unknown) => {
          expect(errorLogService.error).toHaveBeenCalledWith(
            "Failed to load developer subscription pricing tiers",
            testError,
          );
          expect(error).toBe(testError);
          done();
        },
      });
    });
  });

  describe("Edge case handling", () => {
    it("should handle getPremiumPlan() error when getPlans() succeeds", (done) => {
      const errorBillingApiService = mock<BillingApiServiceAbstraction>();
      const errorConfigService = mock<ConfigService>();
      const errorEnvironmentService = mock<EnvironmentService>();

      const testError = new Error("Premium plan API error");
      errorBillingApiService.getPlans.mockResolvedValue(mockPlansResponse);
      errorBillingApiService.getPremiumPlan.mockRejectedValue(testError);
      errorConfigService.getFeatureFlag$.mockReturnValue(of(false));
      setupEnvironmentService(errorEnvironmentService);

      const errorService = new DefaultSubscriptionPricingService(
        errorBillingApiService,
        errorConfigService,
        i18nService,
        logService,
        errorEnvironmentService,
      );

      errorService.getPersonalSubscriptionPricingTiers$().subscribe({
        next: () => {
          fail("Observable should error, not return a value");
        },
        error: (error: unknown) => {
          expect(logService.error).toHaveBeenCalledWith(
            "Failed to fetch premium plan from API",
            testError,
          );
          expect(logService.error).toHaveBeenCalledWith(
            "Failed to load personal subscription pricing tiers",
            testError,
          );
          expect(error).toBe(testError);
          done();
        },
      });
    });
  });

  describe("Observable behavior and caching", () => {
    it("should share API response between multiple subscriptions", () => {
      const getPlansResponse = jest.spyOn(billingApiService, "getPlans");

      // Subscribe to multiple observables
      service.getPersonalSubscriptionPricingTiers$().subscribe();
      service.getBusinessSubscriptionPricingTiers$().subscribe();
      service.getDeveloperSubscriptionPricingTiers$().subscribe();

      // API should only be called once due to shareReplay
      expect(getPlansResponse).toHaveBeenCalledTimes(1);
    });

    it("should share premium plan API response between multiple subscriptions", () => {
      const getPremiumPlanSpy = jest.spyOn(billingApiService, "getPremiumPlan");

      // Subscribe to the premium pricing tier multiple times
      service.getPersonalSubscriptionPricingTiers$().subscribe();
      service.getPersonalSubscriptionPricingTiers$().subscribe();

      // API should only be called once due to shareReplay on premiumPlanResponse$
      expect(getPremiumPlanSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Self-hosted environment behavior", () => {
    it("should not call API for self-hosted environment", () => {
      const selfHostedBillingApiService = mock<BillingApiServiceAbstraction>();
      const selfHostedConfigService = mock<ConfigService>();
      const selfHostedEnvironmentService = mock<EnvironmentService>();

      const getPlansSpy = jest.spyOn(selfHostedBillingApiService, "getPlans");
      const getPremiumPlanSpy = jest.spyOn(selfHostedBillingApiService, "getPremiumPlan");

      selfHostedConfigService.getFeatureFlag$.mockReturnValue(of(false));
      setupEnvironmentService(selfHostedEnvironmentService, Region.SelfHosted);

      const selfHostedService = new DefaultSubscriptionPricingService(
        selfHostedBillingApiService,
        selfHostedConfigService,
        i18nService,
        logService,
        selfHostedEnvironmentService,
      );

      // Trigger subscriptions by calling the methods
      selfHostedService.getPersonalSubscriptionPricingTiers$().subscribe();
      selfHostedService.getBusinessSubscriptionPricingTiers$().subscribe();
      selfHostedService.getDeveloperSubscriptionPricingTiers$().subscribe();

      // API should not be called for self-hosted environments
      expect(getPlansSpy).not.toHaveBeenCalled();
      expect(getPremiumPlanSpy).not.toHaveBeenCalled();
    });

    it("should return valid tier structure with undefined prices for self-hosted", (done) => {
      const selfHostedBillingApiService = mock<BillingApiServiceAbstraction>();
      const selfHostedConfigService = mock<ConfigService>();
      const selfHostedEnvironmentService = mock<EnvironmentService>();

      selfHostedConfigService.getFeatureFlag$.mockReturnValue(of(false));
      setupEnvironmentService(selfHostedEnvironmentService, Region.SelfHosted);

      const selfHostedService = new DefaultSubscriptionPricingService(
        selfHostedBillingApiService,
        selfHostedConfigService,
        i18nService,
        logService,
        selfHostedEnvironmentService,
      );

      selfHostedService.getPersonalSubscriptionPricingTiers$().subscribe((tiers) => {
        expect(tiers).toHaveLength(2); // Premium and Families

        const premiumTier = tiers.find((t) => t.id === PersonalSubscriptionPricingTierIds.Premium);
        expect(premiumTier).toBeDefined();
        expect(premiumTier?.passwordManager.annualPrice).toBeUndefined();
        expect(premiumTier?.passwordManager.annualPricePerAdditionalStorageGB).toBeUndefined();
        expect(premiumTier?.passwordManager.providedStorageGB).toBeUndefined();
        expect(premiumTier?.passwordManager.features).toBeDefined();
        expect(premiumTier?.passwordManager.features.length).toBeGreaterThan(0);

        done();
      });
    });
  });
});
