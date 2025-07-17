import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import { OrganizationWarningsResponse } from "@bitwarden/common/billing/models/response/organization-warnings.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, SimpleDialogOptions } from "@bitwarden/components";

import { OrganizationWarningsService } from "./organization-warnings.service";

// Skipped since Angular complains about `TypeError: Cannot read properties of undefined (reading 'ngModule')`
// which is typically a sign of circular dependencies. The problem seems to be originating from `ChangePlanDialogComponent`.
describe.skip("OrganizationWarningsService", () => {
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationBillingApiService: MockProxy<OrganizationBillingApiServiceAbstraction>;
  let router: MockProxy<Router>;

  let organizationWarningsService: OrganizationWarningsService;

  const respond = (responseBody: any) =>
    Promise.resolve(new OrganizationWarningsResponse(responseBody));

  const empty = () => Promise.resolve(new OrganizationWarningsResponse({}));

  beforeEach(() => {
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationBillingApiService = mock<OrganizationBillingApiServiceAbstraction>();
    router = mock<Router>();

    organizationWarningsService = new OrganizationWarningsService(
      dialogService,
      i18nService,
      organizationApiService,
      organizationBillingApiService,
      router,
    );
  });

  describe("cache$", () => {
    it("should only request warnings once for a specific organization and replay the cached result for multiple subscriptions", async () => {
      const response1 = respond({
        freeTrial: {
          remainingTrialDays: 1,
        },
      });

      const organization1 = {
        id: "1",
        name: "Test",
      } as Organization;

      const response2 = respond({
        freeTrial: {
          remainingTrialDays: 2,
        },
      });

      const organization2 = {
        id: "2",
        name: "Test",
      } as Organization;

      organizationBillingApiService.getWarnings.mockImplementation((id) => {
        if (id === organization1.id) {
          return response1;
        }

        if (id === organization2.id) {
          return response2;
        }

        return empty();
      });

      const oneDayRemainingTranslation = "oneDayRemaining";
      const twoDaysRemainingTranslation = "twoDaysRemaining";

      i18nService.t.mockImplementation((id, p1) => {
        if (id === "freeTrialEndPromptTomorrowNoOrgName") {
          return oneDayRemainingTranslation;
        }

        if (id === "freeTrialEndPromptCount" && p1 === 2) {
          return twoDaysRemainingTranslation;
        }

        return "";
      });

      const organization1Subscription1 = await firstValueFrom(
        organizationWarningsService.getFreeTrialWarning$(organization1),
      );

      const organization1Subscription2 = await firstValueFrom(
        organizationWarningsService.getFreeTrialWarning$(organization1),
      );

      expect(organization1Subscription1).toEqual({
        organization: organization1,
        message: oneDayRemainingTranslation,
      });

      expect(organization1Subscription2).toEqual(organization1Subscription1);

      const organization2Subscription1 = await firstValueFrom(
        organizationWarningsService.getFreeTrialWarning$(organization2),
      );

      const organization2Subscription2 = await firstValueFrom(
        organizationWarningsService.getFreeTrialWarning$(organization2),
      );

      expect(organization2Subscription1).toEqual({
        organization: organization2,
        message: twoDaysRemainingTranslation,
      });

      expect(organization2Subscription2).toEqual(organization2Subscription1);

      expect(organizationBillingApiService.getWarnings).toHaveBeenCalledTimes(2);
    });
  });

  describe("getFreeTrialWarning$", () => {
    it("should not emit a free trial warning when none is included in the warnings response", (done) => {
      const organization = {
        id: "1",
        name: "Test",
      } as Organization;

      organizationBillingApiService.getWarnings.mockReturnValue(empty());

      const warning$ = organizationWarningsService.getFreeTrialWarning$(organization);

      warning$.subscribe({
        next: () => {
          fail("Observable should not emit a value.");
        },
        complete: () => {
          done();
        },
      });
    });

    it("should emit a free trial warning when one is included in the warnings response", async () => {
      const response = respond({
        freeTrial: {
          remainingTrialDays: 1,
        },
      });

      const organization = {
        id: "1",
        name: "Test",
      } as Organization;

      organizationBillingApiService.getWarnings.mockImplementation((id) => {
        if (id === organization.id) {
          return response;
        } else {
          return empty();
        }
      });

      const translation = "translation";
      i18nService.t.mockImplementation((id) => {
        if (id === "freeTrialEndPromptTomorrowNoOrgName") {
          return translation;
        } else {
          return "";
        }
      });

      const warning = await firstValueFrom(
        organizationWarningsService.getFreeTrialWarning$(organization),
      );

      expect(warning).toEqual({
        organization,
        message: translation,
      });
    });
  });

  describe("getResellerRenewalWarning$", () => {
    it("should not emit a reseller renewal warning when none is included in the warnings response", (done) => {
      const organization = {
        id: "1",
        name: "Test",
      } as Organization;

      organizationBillingApiService.getWarnings.mockReturnValue(empty());

      const warning$ = organizationWarningsService.getResellerRenewalWarning$(organization);

      warning$.subscribe({
        next: () => {
          fail("Observable should not emit a value.");
        },
        complete: () => {
          done();
        },
      });
    });

    it("should emit a reseller renewal warning when one is included in the warnings response", async () => {
      const response = respond({
        resellerRenewal: {
          type: "upcoming",
          upcoming: {
            renewalDate: "2026-01-01T00:00:00.000Z",
          },
        },
      });

      const organization = {
        id: "1",
        name: "Test",
        providerName: "Provider",
      } as Organization;

      organizationBillingApiService.getWarnings.mockImplementation((id) => {
        if (id === organization.id) {
          return response;
        } else {
          return empty();
        }
      });

      const formattedDate = new Date("2026-01-01T00:00:00.000Z").toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });

      const translation = "translation";
      i18nService.t.mockImplementation((id, p1, p2) => {
        if (
          id === "resellerRenewalWarningMsg" &&
          p1 === organization.providerName &&
          p2 === formattedDate
        ) {
          return translation;
        } else {
          return "";
        }
      });

      const warning = await firstValueFrom(
        organizationWarningsService.getResellerRenewalWarning$(organization),
      );

      expect(warning).toEqual({
        type: "info",
        message: translation,
      });
    });
  });

  describe("showInactiveSubscriptionDialog$", () => {
    it("should not emit the opening of a dialog for an inactive subscription warning when the warning is not included in the warnings response", (done) => {
      const organization = {
        id: "1",
        name: "Test",
      } as Organization;

      organizationBillingApiService.getWarnings.mockReturnValue(empty());

      const warning$ = organizationWarningsService.showInactiveSubscriptionDialog$(organization);

      warning$.subscribe({
        next: () => {
          fail("Observable should not emit a value.");
        },
        complete: () => {
          done();
        },
      });
    });

    it("should emit the opening of a dialog for an inactive subscription warning when the warning is included in the warnings response", async () => {
      const response = respond({
        inactiveSubscription: {
          resolution: "add_payment_method",
        },
      });

      const organization = {
        id: "1",
        name: "Test",
        providerName: "Provider",
      } as Organization;

      organizationBillingApiService.getWarnings.mockImplementation((id) => {
        if (id === organization.id) {
          return response;
        } else {
          return empty();
        }
      });

      const titleTranslation = "title";
      const continueTranslation = "continue";
      const closeTranslation = "close";

      i18nService.t.mockImplementation((id, param) => {
        if (id === "suspendedOrganizationTitle" && param === organization.name) {
          return titleTranslation;
        }
        if (id === "continue") {
          return continueTranslation;
        }
        if (id === "close") {
          return closeTranslation;
        }
        return "";
      });

      const expectedOptions = {
        title: titleTranslation,
        content: {
          key: "suspendedOwnerOrgMessage",
        },
        type: "danger",
        acceptButtonText: continueTranslation,
        cancelButtonText: closeTranslation,
      } as SimpleDialogOptions;

      dialogService.openSimpleDialog.mockImplementation((options) => {
        if (JSON.stringify(options) == JSON.stringify(expectedOptions)) {
          return Promise.resolve(true);
        } else {
          return Promise.resolve(false);
        }
      });

      const observable$ = organizationWarningsService.showInactiveSubscriptionDialog$(organization);

      const routerNavigateSpy = jest.spyOn(router, "navigate").mockResolvedValue(true);

      await lastValueFrom(observable$);

      expect(routerNavigateSpy).toHaveBeenCalledWith(
        ["organizations", `${organization.id}`, "billing", "payment-method"],
        {
          state: { launchPaymentModalAutomatically: true },
        },
      );
    });
  });
});
