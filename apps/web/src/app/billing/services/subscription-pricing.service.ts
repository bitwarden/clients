import { formatCurrency } from "@angular/common";
import { Injectable } from "@angular/core";
import { combineLatest, from, map, Observable, shareReplay } from "rxjs";
import { catchError } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlanType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import {
  BusinessSubscriptionPricingTier,
  PersonalSubscriptionPricingTier,
  SubscriptionCadenceIds,
} from "@bitwarden/web-vault/app/billing/types/subscription-pricing-tier";

@Injectable({
  providedIn: "root",
})
export class SubscriptionPricingService {
  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private logService: LogService,
    private toastService: ToastService,
  ) {}

  getPersonalTiers$ = (): Observable<PersonalSubscriptionPricingTier[]> =>
    combineLatest([this.premium$, this.families$]).pipe(
      catchError((error: unknown) => {
        this.logService.error(error);
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("unexpectedError"),
        });
        return [];
      }),
    );

  private plansResponse$: Observable<ListResponse<PlanResponse>> = from(
    this.apiService.getPlans(),
  ).pipe(shareReplay({ bufferSize: 1, refCount: false }));

  private premium$: Observable<PersonalSubscriptionPricingTier> = this.plansResponse$.pipe(
    map((plans) => {
      // todo hardcode the premium plan instead of looking for it.
      const premiumPlan = plans.data.find((plan) => plan.type === PlanType.Free)!;

      return {
        id: "premium",
        // todo get the actual keys for name and desc here
        name: this.i18nService.t("planNamePremium"),
        description: this.i18nService.t("planDescPremium", "1"),
        availableCadences: [SubscriptionCadenceIds.Annually],
        passwordManager: {
          type: "standalone",
          monthlyCost: premiumPlan.PasswordManager.basePrice / 12,
          monthlyCostPerAdditionalStorageGB:
            premiumPlan.PasswordManager.additionalStoragePricePerGb / 12,
          features: [
            // todo what are the premium plan features? translations? these are mostly fake
            this.featureTranslations.builtInAuthenticator(),
            this.featureTranslations.encryptedFileStorage(
              premiumPlan.PasswordManager.baseStorageGb,
            ),
            this.featureTranslations.emergencyAccess(),
            this.featureTranslations.breachMonitoring(),
            this.featureTranslations.andMoreFeatures(),
          ],
        },
      };
    }),
  );

  private families$: Observable<PersonalSubscriptionPricingTier> = this.plansResponse$.pipe(
    map((plans) => {
      const familiesPlan = plans.data.find((plan) => plan.type === PlanType.FamiliesAnnually)!;

      return {
        id: "families",
        name: this.i18nService.t("planNameFamilies"),
        description: this.i18nService.t("planDescFamilies"),
        availableCadences: [SubscriptionCadenceIds.Annually],
        passwordManager: {
          type: "packaged",
          users: familiesPlan.PasswordManager.baseSeats,
          monthlyCost: familiesPlan.PasswordManager.basePrice / 12,
          monthlyCostPerAdditionalStorageGB:
            familiesPlan.PasswordManager.additionalStoragePricePerGb / 12,
          features: [
            this.featureTranslations.premiumAccounts(),
            this.featureTranslations.createUnlimitedCollections(),
            this.featureTranslations.unlimitedSharing(),
            this.featureTranslations.addShareLimitedUsers(familiesPlan.PasswordManager.maxSeats),
            this.featureTranslations.createUnlimitedCollections(),
            this.featureTranslations.encryptedFileStorage(
              familiesPlan.PasswordManager.baseStorageGb,
            ),
            this.featureTranslations.optionalSelfHost(),
            this.featureTranslations.usersGetPremium(),
            this.featureTranslations.priorityCustomerSupport(),
            this.featureTranslations.freeTrial(familiesPlan.trialPeriodDays),
          ],
        },
      };
    }),
  );

  private teams$: Observable<BusinessSubscriptionPricingTier> = this.plansResponse$.pipe(
    map((plans) => {
      const annualTeamsPlan = plans.data.find((plan) => plan.type === PlanType.TeamsAnnually)!;

      return {
        id: "teams",
        name: this.i18nService.t("planNameTeams"),
        description: this.i18nService.t("planDescTeams"),
        availableCadences: [SubscriptionCadenceIds.Annually, SubscriptionCadenceIds.Monthly],
        passwordManager: {
          type: "scalable",
          monthlyCostPerUser: annualTeamsPlan.PasswordManager.seatPrice / 12,
          monthlyCostPerAdditionalStorageGB:
            annualTeamsPlan.PasswordManager.additionalStoragePricePerGb / 12,
          features: [
            this.featureTranslations.addShareUnlimitedUsers(),
            this.featureTranslations.createUnlimitedCollections(),
            this.featureTranslations.encryptedFileStorage(
              annualTeamsPlan.PasswordManager.baseStorageGb,
            ),
            this.featureTranslations.controlAccessWithGroups(),
            this.featureTranslations.syncUsersFromDirectory(),
            this.featureTranslations.usersGetPremium(),
            this.featureTranslations.priorityCustomerSupport(),
            this.featureTranslations.freeTrial(annualTeamsPlan.trialPeriodDays),
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
        id: "enterprise",
        name: this.i18nService.t("planNameEnterprise"),
        description: this.i18nService.t("planDesc"),
        availableCadences: ["annually", "monthly"],
        passwordManager: {
          type: "scalable",
          monthlyCostPerUser: annualEnterprisePlan.PasswordManager.seatPrice / 12,
          monthlyCostPerAdditionalStorageGB:
            annualEnterprisePlan.PasswordManager.additionalStoragePricePerGb / 12,
          features: [
            this.featureTranslations.allTeamsFeaturesPlus(),
            this.featureTranslations.optionalSelfHost(),
            this.featureTranslations.ssoAuthentication(),
            this.featureTranslations.enterprisePolicies(),
            this.featureTranslations.freeTrial(annualEnterprisePlan.trialPeriodDays),
          ],
        },
      };
    }),
  );

  private featureTranslations = {
    limitedUsers: (users: number) => ({
      key: "limitedUsers",
      value: this.i18nService.t("limitedUsers", users),
    }),
    limitedCollections: (collections: number) => ({
      key: "limitedCollections",
      value: this.i18nService.t("limitedCollections", collections),
    }),
    addShareLimitedUsers: (users: number) => ({
      key: "addShareLimitedUsers",
      value: this.i18nService.t("addShareLimitedUsers", users),
    }),
    createUnlimitedCollections: () => ({
      key: "createUnlimitedCollections",
      value: this.i18nService.t("createUnlimitedCollections"),
    }),
    encryptedFileStorage: (storageGB: number) => ({
      key: "gbEncryptedFileStorage",
      value: this.i18nService.t("gbEncryptedFileStorage", storageGB + "GB"),
    }),
    optionalSelfHost: () => ({
      key: "onPremHostingOptional",
      value: this.i18nService.t("onPremHostingOptional"),
    }),
    usersGetPremium: () => ({
      key: "usersGetPremium",
      value: this.i18nService.t("usersGetPremium"),
    }),
    priorityCustomerSupport: () => ({
      key: "priorityCustomerSupport",
      value: this.i18nService.t("priorityCustomerSupport"),
    }),
    freeTrial: (days: number) => ({
      key: "xDayFreeTrial",
      value: this.i18nService.t("xDayFreeTrial", days),
    }),
    addShareUnlimitedUsers: () => ({
      key: "addShareUnlimitedUsers",
      value: this.i18nService.t("addShareUnlimitedUsers"),
    }),
    controlAccessWithGroups: () => ({
      key: "controlAccessWithGroups",
      value: this.i18nService.t("controlAccessWithGroups"),
    }),
    syncUsersFromDirectory: () => ({
      key: "syncUsersFromDirectory",
      value: this.i18nService.t("syncUsersFromDirectory"),
    }),
    allTeamsFeaturesPlus: () => ({
      key: "includeAllTeamsFeatures",
      value: this.i18nService.t("includeAllTeamsFeatures"),
    }),
    ssoAuthentication: () => ({
      key: "includeSsoAuthentication",
      value: this.i18nService.t("includeSsoAuthentication"),
    }),
    enterprisePolicies: () => ({
      key: "includeEnterprisePolicies",
      value: this.i18nService.t("includeEnterprisePolicies"),
    }),
    unlimitedSecrets: () => ({
      key: "unlimitedSecrets",
      value: this.i18nService.t("unlimitedSecrets"),
    }),
    limitedProjects: (projects: number) => ({
      key: "projectsIncluded",
      value: this.i18nService.t("projectsIncluded", projects),
    }),
    unlimitedProjects: () => ({
      key: "unlimitedProjects",
      value: this.i18nService.t("unlimitedProjects"),
    }),
    includedMachineAccounts: (machineAccounts: number) => ({
      key: "machineAccountsIncluded",
      value: this.i18nService.t("machineAccountsIncluded", machineAccounts),
    }),
    additionalMachineAccounts: (monthlyCostPerAccount: number) => {
      const cost = formatCurrency(monthlyCostPerAccount, "en-US", "$");
      return {
        key: "additionalMachineAccountCost",
        value: this.i18nService.t("additionalMachineAccountCost", cost!),
      };
    },
    builtInAuthenticator: () => {
      return {
        key: "builtInAuthenticator",
        value: this.i18nService.t("builtInAuthenticator"),
      };
    },
    emergencyAccess: () => {
      return {
        key: "emergencyAccess",
        value: this.i18nService.t("emergencyAccess"),
      };
    },
    breachMonitoring: () => {
      return {
        key: "breachMonitoring",
        value: this.i18nService.t("breachMonitoring"),
      };
    },
    andMoreFeatures: () => {
      return {
        key: "andMoreFeatures",
        value: this.i18nService.t("andMoreFeatures"),
      };
    },
    premiumAccounts: () => {
      return {
        key: "premiumAccounts",
        value: this.i18nService.t("premiumAccounts"),
      };
    },
    unlimitedSharing: () => {
      return {
        key: "unlimitedSharing",
        value: this.i18nService.t("unlimitedSharing"),
      };
    },
  };
}
