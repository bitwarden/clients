jest.mock("@bitwarden/web-vault/app/billing/organizations/change-plan-dialog.component", () => ({
  ChangePlanDialogResultType: {
    Submitted: "submitted",
    Cancelled: "cancelled",
  },
  openChangePlanDialog: jest.fn(),
}));

import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService } from "@bitwarden/components";
import { OrganizationBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import {
  ChangePlanDialogResultType,
  openChangePlanDialog,
} from "@bitwarden/web-vault/app/billing/organizations/change-plan-dialog.component";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services/organization-warnings.service";
import { OrganizationWarningsResponse } from "@bitwarden/web-vault/app/billing/organizations/warnings/types";
import {
  TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE,
  TrialPaymentDialogComponent,
  TrialPaymentDialogResultType,
} from "@bitwarden/web-vault/app/billing/shared/trial-payment-dialog/trial-payment-dialog.component";
import { TaxIdWarningTypes } from "@bitwarden/web-vault/app/billing/warnings/types";

describe("OrganizationWarningsService", () => {
  let service: OrganizationWarningsService;
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationBillingClient: MockProxy<OrganizationBillingClient>;
  let router: MockProxy<Router>;

  const organization = {
    id: "org-id-123",
    name: "Test Organization",
    providerName: "Test Reseller Inc",
    productTierType: ProductTierType.Enterprise,
  } as Organization;

  const format = (date: Date): string =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

  beforeEach(() => {
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationBillingClient = mock<OrganizationBillingClient>();
    router = mock<Router>();

    (openChangePlanDialog as jest.Mock).mockReset();

    i18nService.t.mockImplementation((key: string, ...args: any[]) => {
      switch (key) {
        case "freeTrialEndPromptCount":
          return `Your free trial ends in ${args[0]} days.`;
        case "freeTrialEndPromptTomorrowNoOrgName":
          return "Your free trial ends tomorrow.";
        case "freeTrialEndingTodayWithoutOrgName":
          return "Your free trial ends today.";
        case "resellerRenewalWarningMsg":
          return `Your subscription will renew soon. To ensure uninterrupted service, contact ${args[0]} to confirm your renewal before ${args[1]}.`;
        case "resellerOpenInvoiceWarningMgs":
          return `An invoice for your subscription was issued on ${args[1]}. To ensure uninterrupted service, contact ${args[0]} to confirm your renewal before ${args[2]}.`;
        case "resellerPastDueWarningMsg":
          return `The invoice for your subscription has not been paid. To ensure uninterrupted service, contact ${args[0]} to confirm your renewal before ${args[1]}.`;
        case "suspendedOrganizationTitle":
          return `${args[0]} subscription suspended`;
        case "close":
          return "Close";
        case "continue":
          return "Continue";
        default:
          return key;
      }
    });

    TestBed.configureTestingModule({
      providers: [
        OrganizationWarningsService,
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: OrganizationApiServiceAbstraction, useValue: organizationApiService },
        { provide: OrganizationBillingClient, useValue: organizationBillingClient },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(OrganizationWarningsService);
  });

  describe("getFreeTrialWarning$", () => {
    it("should return null when no free trial warning exists", (done) => {
      organizationBillingClient.getWarnings.mockResolvedValue({} as OrganizationWarningsResponse);

      service.getFreeTrialWarning$(organization).subscribe((result) => {
        expect(result).toBeNull();
        done();
      });
    });

    it("should return warning with count message when remaining trial days >= 2", (done) => {
      const warning = { remainingTrialDays: 5 };
      organizationBillingClient.getWarnings.mockResolvedValue({
        freeTrial: warning,
      } as OrganizationWarningsResponse);

      service.getFreeTrialWarning$(organization).subscribe((result) => {
        expect(result).toEqual({
          organization: organization,
          message: "Your free trial ends in 5 days.",
        });
        expect(i18nService.t).toHaveBeenCalledWith("freeTrialEndPromptCount", 5);
        done();
      });
    });

    it("should return warning with tomorrow message when remaining trial days = 1", (done) => {
      const warning = { remainingTrialDays: 1 };
      organizationBillingClient.getWarnings.mockResolvedValue({
        freeTrial: warning,
      } as OrganizationWarningsResponse);

      service.getFreeTrialWarning$(organization).subscribe((result) => {
        expect(result).toEqual({
          organization: organization,
          message: "Your free trial ends tomorrow.",
        });
        expect(i18nService.t).toHaveBeenCalledWith("freeTrialEndPromptTomorrowNoOrgName");
        done();
      });
    });

    it("should return warning with today message when remaining trial days = 0", (done) => {
      const warning = { remainingTrialDays: 0 };
      organizationBillingClient.getWarnings.mockResolvedValue({
        freeTrial: warning,
      } as OrganizationWarningsResponse);

      service.getFreeTrialWarning$(organization).subscribe((result) => {
        expect(result).toEqual({
          organization: organization,
          message: "Your free trial ends today.",
        });
        expect(i18nService.t).toHaveBeenCalledWith("freeTrialEndingTodayWithoutOrgName");
        done();
      });
    });

    it("should refresh warning when refreshFreeTrialWarning is called", (done) => {
      const initialWarning = { remainingTrialDays: 3 };
      const refreshedWarning = { remainingTrialDays: 2 };
      let invocationCount = 0;

      organizationBillingClient.getWarnings
        .mockResolvedValueOnce({
          freeTrial: initialWarning,
        } as OrganizationWarningsResponse)
        .mockResolvedValueOnce({
          freeTrial: refreshedWarning,
        } as OrganizationWarningsResponse);

      const subscription = service.getFreeTrialWarning$(organization).subscribe((result) => {
        invocationCount++;

        if (invocationCount === 1) {
          expect(result).toEqual({
            organization: organization,
            message: "Your free trial ends in 3 days.",
          });
        } else if (invocationCount === 2) {
          expect(result).toEqual({
            organization: organization,
            message: "Your free trial ends in 2 days.",
          });
          subscription.unsubscribe();
          done();
        }
      });

      setTimeout(() => {
        service.refreshFreeTrialWarning();
      }, 10);
    });
  });

  describe("getResellerRenewalWarning$", () => {
    it("should return null when no reseller renewal warning exists", (done) => {
      organizationBillingClient.getWarnings.mockResolvedValue({} as OrganizationWarningsResponse);

      service.getResellerRenewalWarning$(organization).subscribe((result) => {
        expect(result).toBeNull();
        done();
      });
    });

    it("should return upcoming warning with correct type and message", (done) => {
      const renewalDate = new Date(2024, 11, 31);
      const warning = {
        type: "upcoming" as const,
        upcoming: { renewalDate },
      };
      organizationBillingClient.getWarnings.mockResolvedValue({
        resellerRenewal: warning,
      } as OrganizationWarningsResponse);

      service.getResellerRenewalWarning$(organization).subscribe((result) => {
        const expectedFormattedDate = format(renewalDate);

        expect(result).toEqual({
          type: "info",
          message: `Your subscription will renew soon. To ensure uninterrupted service, contact Test Reseller Inc to confirm your renewal before ${expectedFormattedDate}.`,
        });
        expect(i18nService.t).toHaveBeenCalledWith(
          "resellerRenewalWarningMsg",
          "Test Reseller Inc",
          expectedFormattedDate,
        );
        done();
      });
    });

    it("should return issued warning with correct type and message", (done) => {
      const issuedDate = new Date(2024, 10, 15);
      const dueDate = new Date(2024, 11, 15);
      const warning = {
        type: "issued" as const,
        issued: { issuedDate, dueDate },
      };
      organizationBillingClient.getWarnings.mockResolvedValue({
        resellerRenewal: warning,
      } as OrganizationWarningsResponse);

      service.getResellerRenewalWarning$(organization).subscribe((result) => {
        const expectedIssuedDate = format(issuedDate);
        const expectedDueDate = format(dueDate);

        expect(result).toEqual({
          type: "info",
          message: `An invoice for your subscription was issued on ${expectedIssuedDate}. To ensure uninterrupted service, contact Test Reseller Inc to confirm your renewal before ${expectedDueDate}.`,
        });
        expect(i18nService.t).toHaveBeenCalledWith(
          "resellerOpenInvoiceWarningMgs",
          "Test Reseller Inc",
          expectedIssuedDate,
          expectedDueDate,
        );
        done();
      });
    });

    it("should return past_due warning with correct type and message", (done) => {
      const suspensionDate = new Date(2024, 11, 1);
      const warning = {
        type: "past_due" as const,
        pastDue: { suspensionDate },
      };
      organizationBillingClient.getWarnings.mockResolvedValue({
        resellerRenewal: warning,
      } as OrganizationWarningsResponse);

      service.getResellerRenewalWarning$(organization).subscribe((result) => {
        const expectedSuspensionDate = format(suspensionDate);

        expect(result).toEqual({
          type: "warning",
          message: `The invoice for your subscription has not been paid. To ensure uninterrupted service, contact Test Reseller Inc to confirm your renewal before ${expectedSuspensionDate}.`,
        });
        expect(i18nService.t).toHaveBeenCalledWith(
          "resellerPastDueWarningMsg",
          "Test Reseller Inc",
          expectedSuspensionDate,
        );
        done();
      });
    });
  });

  describe("getTaxIdWarning$", () => {
    it("should return null when no tax ID warning exists", (done) => {
      organizationBillingClient.getWarnings.mockResolvedValue({} as OrganizationWarningsResponse);

      service.getTaxIdWarning$(organization).subscribe((result) => {
        expect(result).toBeNull();
        done();
      });
    });

    it("should return tax_id_missing type when tax ID is missing", (done) => {
      const warning = { type: TaxIdWarningTypes.Missing };
      organizationBillingClient.getWarnings.mockResolvedValue({
        taxId: warning,
      } as OrganizationWarningsResponse);

      service.getTaxIdWarning$(organization).subscribe((result) => {
        expect(result).toBe(TaxIdWarningTypes.Missing);
        done();
      });
    });

    it("should return tax_id_pending_verification type when tax ID verification is pending", (done) => {
      const warning = { type: TaxIdWarningTypes.PendingVerification };
      organizationBillingClient.getWarnings.mockResolvedValue({
        taxId: warning,
      } as OrganizationWarningsResponse);

      service.getTaxIdWarning$(organization).subscribe((result) => {
        expect(result).toBe(TaxIdWarningTypes.PendingVerification);
        done();
      });
    });

    it("should return tax_id_failed_verification type when tax ID verification failed", (done) => {
      const warning = { type: TaxIdWarningTypes.FailedVerification };
      organizationBillingClient.getWarnings.mockResolvedValue({
        taxId: warning,
      } as OrganizationWarningsResponse);

      service.getTaxIdWarning$(organization).subscribe((result) => {
        expect(result).toBe(TaxIdWarningTypes.FailedVerification);
        done();
      });
    });

    it("should refresh warning and update taxIdWarningRefreshedSubject when refreshTaxIdWarning is called", (done) => {
      const initialWarning = { type: TaxIdWarningTypes.Missing };
      const refreshedWarning = { type: TaxIdWarningTypes.FailedVerification };
      let invocationCount = 0;

      organizationBillingClient.getWarnings
        .mockResolvedValueOnce({
          taxId: initialWarning,
        } as OrganizationWarningsResponse)
        .mockResolvedValueOnce({
          taxId: refreshedWarning,
        } as OrganizationWarningsResponse);

      const subscription = service.getTaxIdWarning$(organization).subscribe((result) => {
        invocationCount++;

        if (invocationCount === 1) {
          expect(result).toBe(TaxIdWarningTypes.Missing);
        } else if (invocationCount === 2) {
          expect(result).toBe(TaxIdWarningTypes.FailedVerification);
          subscription.unsubscribe();
          done();
        }
      });

      setTimeout(() => {
        service.refreshTaxIdWarning();
      }, 10);
    });

    it("should update taxIdWarningRefreshedSubject with warning type when refresh returns a warning", (done) => {
      const refreshedWarning = { type: TaxIdWarningTypes.Missing };
      let refreshedCount = 0;

      organizationBillingClient.getWarnings
        .mockResolvedValueOnce({} as OrganizationWarningsResponse)
        .mockResolvedValueOnce({
          taxId: refreshedWarning,
        } as OrganizationWarningsResponse);

      const taxIdSubscription = service.taxIdWarningRefreshed$.subscribe((refreshedType) => {
        refreshedCount++;
        if (refreshedCount === 2) {
          expect(refreshedType).toBe(TaxIdWarningTypes.Missing);
          taxIdSubscription.unsubscribe();
          done();
        }
      });

      service.getTaxIdWarning$(organization).subscribe();

      setTimeout(() => {
        service.refreshTaxIdWarning();
      }, 10);
    });

    it("should update taxIdWarningRefreshedSubject with null when refresh returns no warning", (done) => {
      const initialWarning = { type: TaxIdWarningTypes.Missing };
      let refreshedCount = 0;

      organizationBillingClient.getWarnings
        .mockResolvedValueOnce({
          taxId: initialWarning,
        } as OrganizationWarningsResponse)
        .mockResolvedValueOnce({} as OrganizationWarningsResponse);

      const taxIdSubscription = service.taxIdWarningRefreshed$.subscribe((refreshedType) => {
        refreshedCount++;
        if (refreshedCount === 2) {
          expect(refreshedType).toBeNull();
          taxIdSubscription.unsubscribe();
          done();
        }
      });

      service.getTaxIdWarning$(organization).subscribe();

      setTimeout(() => {
        service.refreshTaxIdWarning();
      }, 10);
    });
  });

  describe("showInactiveSubscriptionDialog$", () => {
    it("should not show dialog when no inactive subscription warning exists", (done) => {
      organizationBillingClient.getWarnings.mockResolvedValue({} as OrganizationWarningsResponse);

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        done();
      });
    });

    it("should show contact provider dialog for contact_provider resolution", (done) => {
      const warning = { resolution: "contact_provider" };
      organizationBillingClient.getWarnings.mockResolvedValue({
        inactiveSubscription: warning,
      } as OrganizationWarningsResponse);

      dialogService.openSimpleDialog.mockResolvedValue(true);

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          title: "Test Organization subscription suspended",
          content: {
            key: "suspendedManagedOrgMessage",
            placeholders: ["Test Reseller Inc"],
          },
          type: "danger",
          acceptButtonText: "Close",
          cancelButtonText: null,
        });
        done();
      });
    });

    it("should show add payment method dialog and navigate when confirmed", (done) => {
      const warning = { resolution: "add_payment_method" };
      organizationBillingClient.getWarnings.mockResolvedValue({
        inactiveSubscription: warning,
      } as OrganizationWarningsResponse);

      dialogService.openSimpleDialog.mockResolvedValue(true);
      router.navigate.mockResolvedValue(true);

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          title: "Test Organization subscription suspended",
          content: { key: "suspendedOwnerOrgMessage" },
          type: "danger",
          acceptButtonText: "Continue",
          cancelButtonText: "Close",
        });
        expect(router.navigate).toHaveBeenCalledWith(
          ["organizations", "org-id-123", "billing", "payment-details"],
          { state: { launchPaymentModalAutomatically: true } },
        );
        done();
      });
    });

    it("should navigate to payment-details when feature flag is enabled", (done) => {
      const warning = { resolution: "add_payment_method" };
      organizationBillingClient.getWarnings.mockResolvedValue({
        inactiveSubscription: warning,
      } as OrganizationWarningsResponse);

      dialogService.openSimpleDialog.mockResolvedValue(true);
      router.navigate.mockResolvedValue(true);

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(router.navigate).toHaveBeenCalledWith(
          ["organizations", "org-id-123", "billing", "payment-details"],
          { state: { launchPaymentModalAutomatically: true } },
        );
        done();
      });
    });

    it("should not navigate when add payment method dialog is cancelled", (done) => {
      const warning = { resolution: "add_payment_method" };
      organizationBillingClient.getWarnings.mockResolvedValue({
        inactiveSubscription: warning,
      } as OrganizationWarningsResponse);

      dialogService.openSimpleDialog.mockResolvedValue(false);

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(dialogService.openSimpleDialog).toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      });
    });

    it("should open change plan dialog for resubscribe resolution", (done) => {
      const warning = { resolution: "resubscribe" };
      const subscription = { id: "sub-123" } as OrganizationSubscriptionResponse;

      organizationBillingClient.getWarnings.mockResolvedValue({
        inactiveSubscription: warning,
      } as OrganizationWarningsResponse);

      organizationApiService.getSubscription.mockResolvedValue(subscription);

      const mockDialogRef = {
        closed: of("submitted"),
      } as DialogRef<ChangePlanDialogResultType>;

      (openChangePlanDialog as jest.Mock).mockReturnValue(mockDialogRef);

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(organizationApiService.getSubscription).toHaveBeenCalledWith(organization.id);
        expect(openChangePlanDialog).toHaveBeenCalledWith(dialogService, {
          data: {
            organizationId: organization.id,
            subscription: subscription,
            productTierType: organization.productTierType,
          },
        });
        done();
      });
    });

    it("should show contact owner dialog for contact_owner resolution", (done) => {
      const warning = { resolution: "contact_owner" };
      organizationBillingClient.getWarnings.mockResolvedValue({
        inactiveSubscription: warning,
      } as OrganizationWarningsResponse);

      dialogService.openSimpleDialog.mockResolvedValue(true);

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          title: "Test Organization subscription suspended",
          content: { key: "suspendedUserOrgMessage" },
          type: "danger",
          acceptButtonText: "Close",
          cancelButtonText: null,
        });
        done();
      });
    });
  });

  describe("showSubscribeBeforeFreeTrialEndsDialog$", () => {
    it("should not show dialog when no free trial warning exists", (done) => {
      organizationBillingClient.getWarnings.mockResolvedValue({} as OrganizationWarningsResponse);

      service.showSubscribeBeforeFreeTrialEndsDialog$(organization).subscribe({
        complete: () => {
          expect(organizationApiService.getSubscription).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it("should open trial payment dialog when free trial warning exists", (done) => {
      const warning = { remainingTrialDays: 2 };
      const subscription = { id: "sub-123" } as OrganizationSubscriptionResponse;

      organizationBillingClient.getWarnings.mockResolvedValue({
        freeTrial: warning,
      } as OrganizationWarningsResponse);

      organizationApiService.getSubscription.mockResolvedValue(subscription);

      const mockDialogRef = {
        closed: of(TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.CLOSED),
      } as DialogRef<TrialPaymentDialogResultType>;

      const openSpy = jest
        .spyOn(TrialPaymentDialogComponent, "open")
        .mockReturnValue(mockDialogRef);

      service.showSubscribeBeforeFreeTrialEndsDialog$(organization).subscribe({
        complete: () => {
          expect(organizationApiService.getSubscription).toHaveBeenCalledWith(organization.id);
          expect(openSpy).toHaveBeenCalledWith(dialogService, {
            data: {
              organizationId: organization.id,
              subscription: subscription,
              productTierType: organization.productTierType,
            },
          });
          done();
        },
      });
    });

    it("should refresh free trial warning when dialog result is SUBMITTED", (done) => {
      const warning = { remainingTrialDays: 1 };
      const subscription = { id: "sub-456" } as OrganizationSubscriptionResponse;

      organizationBillingClient.getWarnings.mockResolvedValue({
        freeTrial: warning,
      } as OrganizationWarningsResponse);

      organizationApiService.getSubscription.mockResolvedValue(subscription);

      const mockDialogRef = {
        closed: of(TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.SUBMITTED),
      } as DialogRef<TrialPaymentDialogResultType>;

      jest.spyOn(TrialPaymentDialogComponent, "open").mockReturnValue(mockDialogRef);

      const refreshTriggerSpy = jest.spyOn(service["refreshFreeTrialWarningTrigger"], "next");

      service.showSubscribeBeforeFreeTrialEndsDialog$(organization).subscribe({
        complete: () => {
          expect(refreshTriggerSpy).toHaveBeenCalled();
          done();
        },
      });
    });

    it("should not refresh free trial warning when dialog result is CLOSED", (done) => {
      const warning = { remainingTrialDays: 3 };
      const subscription = { id: "sub-789" } as OrganizationSubscriptionResponse;

      organizationBillingClient.getWarnings.mockResolvedValue({
        freeTrial: warning,
      } as OrganizationWarningsResponse);

      organizationApiService.getSubscription.mockResolvedValue(subscription);

      const mockDialogRef = {
        closed: of(TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.CLOSED),
      } as DialogRef<TrialPaymentDialogResultType>;

      jest.spyOn(TrialPaymentDialogComponent, "open").mockReturnValue(mockDialogRef);
      const refreshSpy = jest.spyOn(service, "refreshFreeTrialWarning");

      service.showSubscribeBeforeFreeTrialEndsDialog$(organization).subscribe({
        complete: () => {
          expect(refreshSpy).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
