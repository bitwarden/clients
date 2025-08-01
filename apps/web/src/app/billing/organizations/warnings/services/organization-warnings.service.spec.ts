import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of, tap } from "rxjs";
import { concatMap, take } from "rxjs/operators";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationSubscriptionResponse } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { OrganizationBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import {
  TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE,
  TrialPaymentDialogComponent,
  TrialPaymentDialogResultType,
} from "../../../shared/trial-payment-dialog/trial-payment-dialog.component";
import { openChangePlanDialog } from "../../change-plan-dialog.component";
import { OrganizationWarningsModule } from "../organization-warnings.module";
import { OrganizationWarningsService } from "../services";
import { OrganizationWarningsResponse } from "../types";

jest.mock("../../change-plan-dialog.component", () => ({
  openChangePlanDialog: jest.fn(),
}));

describe("OrganizationWarningsService", () => {
  let service: OrganizationWarningsService;
  let configService: MockProxy<ConfigService>;
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationBillingClient: MockProxy<OrganizationBillingClient>;
  let router: MockProxy<Router>;
  let syncService: MockProxy<SyncService>;

  beforeEach(() => {
    configService = mock<ConfigService>();
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    organizationBillingClient = mock<OrganizationBillingClient>();
    router = mock<Router>();
    syncService = mock<SyncService>();

    TestBed.configureTestingModule({
      imports: [OrganizationWarningsModule],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: OrganizationApiServiceAbstraction, useValue: organizationApiService },
        { provide: OrganizationBillingClient, useValue: organizationBillingClient },
        { provide: Router, useValue: router },
        { provide: SyncService, useValue: syncService },
      ],
    });

    service = TestBed.inject(OrganizationWarningsService);
  });

  it("should create the service", () => {
    expect(service).toBeTruthy();
  });

  describe("getFreeTrialWarning$", () => {
    const organization = { id: "1", name: "Test Org" } as Organization;

    it("should return a free trial warning with days remaining message when more than 1 day left", (done) => {
      const response = {
        freeTrial: { remainingTrialDays: 5 },
      } as OrganizationWarningsResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);
      i18nService.t.mockImplementation((key, ...args) => {
        if (key === "freeTrialEndPromptCount") {
          return `Your trial ends in ${args[0]} days`;
        }
        return key;
      });

      service
        .getFreeTrialWarning$(organization)
        .pipe(take(1))
        .subscribe((warning) => {
          expect(warning).toEqual({
            organization,
            message: "Your trial ends in 5 days",
          });
          done();
        });
    });

    it("should return a free trial warning with tomorrow message when 1 day left", (done) => {
      const response = {
        freeTrial: { remainingTrialDays: 1 },
      } as OrganizationWarningsResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);
      i18nService.t.mockImplementation((key) => {
        if (key === "freeTrialEndPromptTomorrowNoOrgName") {
          return "Your trial ends tomorrow";
        }
        return key;
      });

      service
        .getFreeTrialWarning$(organization)
        .pipe(take(1))
        .subscribe((warning) => {
          expect(warning).toEqual({
            organization,
            message: "Your trial ends tomorrow",
          });
          done();
        });
    });

    it("should return a free trial warning with today message when 0 days left", (done) => {
      const response = {
        freeTrial: { remainingTrialDays: 0 },
      } as OrganizationWarningsResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);
      i18nService.t.mockImplementation((key) => {
        if (key === "freeTrialEndingTodayWithoutOrgName") {
          return "Your trial ends today";
        }
        return key;
      });

      service
        .getFreeTrialWarning$(organization)
        .pipe(take(1))
        .subscribe((warning) => {
          expect(warning).toEqual({
            organization,
            message: "Your trial ends today",
          });
          done();
        });
    });

    it("should bypass cache when bypassCache is true", (done) => {
      const response = {
        freeTrial: { remainingTrialDays: 5 },
      } as OrganizationWarningsResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);
      i18nService.t.mockReturnValue("Your trial ends in 5 days");

      service
        .getFreeTrialWarning$(organization)
        .pipe(
          take(1),
          tap(() => {
            organizationBillingClient.getWarnings.mockClear();
          }),
          concatMap(() => service.getFreeTrialWarning$(organization, true).pipe(take(1))),
        )
        .subscribe(() => {
          expect(organizationBillingClient.getWarnings).toHaveBeenCalledWith(organization.id);
          done();
        });
    });
  });

  describe("getResellerRenewalWarning$", () => {
    const organization = {
      id: "1",
      name: "Test Org",
      providerName: "Test Provider",
    } as Organization;

    it("should return an info warning for upcoming renewal", (done) => {
      const renewalDate = new Date(2023, 5, 15);
      const response = {
        resellerRenewal: {
          type: "upcoming",
          upcoming: { renewalDate },
        },
      } as OrganizationWarningsResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);

      const formattedDate = "Jun 15, 2023";
      i18nService.t.mockImplementation((key, ...args) => {
        if (key === "resellerRenewalWarningMsg") {
          return `${args[0]} will renew on ${args[1]}`;
        }
        return key;
      });

      service
        .getResellerRenewalWarning$(organization)
        .pipe(take(1))
        .subscribe((warning) => {
          // Full assertion with exact message
          expect(warning).toEqual({
            type: "info",
            message: `Test Provider will renew on ${formattedDate}`,
          });
          done();
        });
    });

    it("should return an info warning for issued invoice", (done) => {
      const issuedDate = new Date(2023, 5, 15);
      const dueDate = new Date(2023, 5, 30);
      const response = {
        resellerRenewal: {
          type: "issued",
          issued: { issuedDate, dueDate },
        },
      } as OrganizationWarningsResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);

      const formattedIssuedDate = "Jun 15, 2023";
      const formattedDueDate = "Jun 30, 2023";

      i18nService.t.mockImplementation((key, ...args) => {
        if (key === "resellerOpenInvoiceWarningMgs") {
          return `${args[0]} issued invoice on ${args[1]}, due on ${args[2]}`;
        }
        return key;
      });

      service
        .getResellerRenewalWarning$(organization)
        .pipe(take(1))
        .subscribe((warning) => {
          expect(warning).toEqual({
            type: "info",
            message: `Test Provider issued invoice on ${formattedIssuedDate}, due on ${formattedDueDate}`,
          });
          done();
        });
    });

    it("should return a warning for past due invoice", (done) => {
      const suspensionDate = new Date(2023, 6, 15);
      const response = {
        resellerRenewal: {
          type: "past_due",
          pastDue: { suspensionDate },
        },
      } as OrganizationWarningsResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);

      const formattedSuspensionDate = "Jul 15, 2023";

      i18nService.t.mockImplementation((key, ...args) => {
        if (key === "resellerPastDueWarningMsg") {
          return `${args[0]} payment is past due, suspension on ${args[1]}`;
        }
        return key;
      });

      service
        .getResellerRenewalWarning$(organization)
        .pipe(take(1))
        .subscribe((warning) => {
          expect(warning).toEqual({
            type: "warning",
            message: `Test Provider payment is past due, suspension on ${formattedSuspensionDate}`,
          });
          done();
        });
    });
  });

  describe("showInactiveSubscriptionDialog$", () => {
    const organization = {
      id: "1",
      name: "Test Org",
      providerName: "Test Provider",
      productTierType: ProductTierType.Enterprise,
    } as Organization;

    it("should show contact provider dialog when resolution is contact_provider", (done) => {
      const warning = {
        inactiveSubscription: { resolution: "contact_provider" },
      } as OrganizationWarningsResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(warning);
      dialogService.openSimpleDialog.mockResolvedValue(true);

      const mockedTitle = `The ${organization.name} is suspended`;
      const mockedAcceptButtonText = "Close";

      i18nService.t.mockImplementation((key, ...args) => {
        switch (key) {
          case "suspendedOrganizationTitle":
            return args[0] === organization.name ? mockedTitle : key;
          case "close":
            return mockedAcceptButtonText;
          default:
            return key;
        }
      });

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          title: mockedTitle,
          content: expect.objectContaining({
            key: "suspendedManagedOrgMessage",
            placeholders: [organization.providerName],
          }),
          type: "danger",
          acceptButtonText: mockedAcceptButtonText,
          cancelButtonText: null,
        });
        done();
      });
    });

    it("should show add payment method dialog and navigate when resolution is add_payment_method", (done) => {
      const organization = { id: "1", name: "Test Org" } as Organization;
      const response = {
        inactiveSubscription: { resolution: "add_payment_method" },
      } as OrganizationWarningsResponse;

      const mockedTitle = "Suspended Test Org";

      organizationBillingClient.getWarnings.mockResolvedValue(response);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      configService.getFeatureFlag.mockResolvedValue(true);

      i18nService.t.mockImplementation((key, ...args) => {
        if (key === "suspendedOrganizationTitle" && args[0] === organization.name) {
          return mockedTitle;
        } else if (key === "continue") {
          return "Continue";
        } else if (key === "close") {
          return "Close";
        }
        return key;
      });

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
          title: mockedTitle,
          content: { key: "suspendedOwnerOrgMessage" },
          type: "danger",
          acceptButtonText: "Continue",
          cancelButtonText: "Close",
        });

        expect(router.navigate).toHaveBeenCalledWith(
          ["organizations", organization.id, "billing", "payment-details"],
          expect.objectContaining({
            state: { launchPaymentModalAutomatically: true },
          }),
        );

        done();
      });
    });

    it("should show resubscribe dialog when resolution is resubscribe", (done) => {
      const response = {
        inactiveSubscription: { resolution: "resubscribe" },
      } as OrganizationWarningsResponse;

      const subscription = {
        subscription: {
          status: "canceled",
        },
      } as OrganizationSubscriptionResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);
      organizationApiService.getSubscription.mockResolvedValue(subscription);

      const mockDialogRef = { closed: of(true) } as DialogRef;
      (openChangePlanDialog as jest.Mock).mockReturnValue(mockDialogRef);

      service.showInactiveSubscriptionDialog$(organization).subscribe(() => {
        expect(openChangePlanDialog).toHaveBeenCalledWith(dialogService, {
          data: expect.objectContaining({
            organizationId: organization.id,
            subscription,
            productTierType: organization.productTierType,
          }),
        });
        done();
      });
    });
  });

  describe("showSubscribeBeforeFreeTrialEndsDialog$", () => {
    const organization = {
      id: "1",
      name: "Test Org",
      productTierType: ProductTierType.Enterprise,
    } as Organization;

    it("should show trial payment dialog and refresh when submitted", (done) => {
      const response = {
        freeTrial: { remainingTrialDays: 5 },
      } as OrganizationWarningsResponse;

      const subscription = {
        subscription: {
          status: "trialing",
        },
      } as OrganizationSubscriptionResponse;

      organizationBillingClient.getWarnings.mockResolvedValue(response);
      organizationApiService.getSubscription.mockResolvedValue(subscription);

      const mockDialogRef = {
        closed: of(TRIAL_PAYMENT_METHOD_DIALOG_RESULT_TYPE.SUBMITTED),
      } as DialogRef<TrialPaymentDialogResultType>;

      jest.spyOn(TrialPaymentDialogComponent, "open").mockReturnValue(mockDialogRef);

      const refreshSpy = jest.spyOn(service["refreshFreeTrialWarning$"], "next");

      service.showSubscribeBeforeFreeTrialEndsDialog$(organization).subscribe(() => {
        expect(TrialPaymentDialogComponent.open).toHaveBeenCalledWith(dialogService, {
          data: expect.objectContaining({
            organizationId: organization.id,
            subscription,
            productTierType: organization.productTierType,
          }),
        });
        expect(refreshSpy).toHaveBeenCalledWith(organization.id);
        done();
      });
    });
  });

  describe("freeTrialWarningRefreshed$", () => {
    it("should expose an observable for subscription", (done) => {
      const organizationId = "1" as OrganizationId;

      service.freeTrialWarningRefreshed$.pipe(take(1)).subscribe((id) => {
        expect(id).toBe(organizationId);
        done();
      });

      service["refreshFreeTrialWarning$"].next(organizationId);
    });
  });
});
