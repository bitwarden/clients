import { DatePipe } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, mockReset } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { OrganizationBillingClient } from "../clients";

import { ChurnMitigationOfferDialogResultType } from "./churn-mitigation-offer-dialog.component";
import { OrganizationSubscriptionCloudComponent } from "./organization-subscription-cloud.component";

function makeDialogRef<R>(result: R): Pick<DialogRef<R>, "closed"> {
  return { closed: of(result) };
}

describe("OrganizationSubscriptionCloudComponent.cancelSubscription", () => {
  const mockDialogService = mock<DialogService>();
  const mockOrganizationBillingClient = mock<OrganizationBillingClient>();
  const mockOrganizationApiService = mock<OrganizationApiServiceAbstraction>();
  const mockI18nService = mock<I18nService>();
  const mockLogService = mock<LogService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockAccountService = mock<AccountService>();
  const mockApiService = mock<ApiService>();
  const mockToastService = mock<ToastService>();
  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockDatePipe = mock<DatePipe>();

  let component: OrganizationSubscriptionCloudComponent;

  const orgId = "org-abc";

  const mockOffer = {
    couponId: "CHURN25",
    percentOff: 25,
    duration: "repeating",
    durationInMonths: 12,
    name: "Loyalty Discount",
  } as any;

  const mockSub = {
    plan: { type: 9, productTier: 3, isAnnual: true },
    subscription: { periodEndDate: "2026-12-31" },
  } as any;

  beforeEach(() => {
    mockReset(mockDialogService);
    mockReset(mockOrganizationBillingClient);

    TestBed.configureTestingModule({
      providers: [
        OrganizationSubscriptionCloudComponent,
        { provide: ApiService, useValue: mockApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationApiServiceAbstraction, useValue: mockOrganizationApiService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: {},
              queryParams: {},
              queryParamMap: { get: (_key: string): string | null => null },
            },
          },
        },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: DatePipe, useValue: mockDatePipe },
        { provide: OrganizationBillingClient, useValue: mockOrganizationBillingClient },
      ],
    });

    component = TestBed.inject(OrganizationSubscriptionCloudComponent);
    component.organizationId = orgId;
    component.sub = mockSub;
  });

  describe("eligible org (offer returned)", () => {
    beforeEach(() => {
      mockOrganizationBillingClient.getChurnOffer.mockResolvedValue(mockOffer);
    });

    it("opens the churn-offer dialog instead of the offboarding survey directly", async () => {
      mockDialogService.open.mockReturnValue(
        makeDialogRef(ChurnMitigationOfferDialogResultType.Closed) as any,
      );

      await component.cancelSubscription();

      expect(mockOrganizationBillingClient.getChurnOffer).toHaveBeenCalledWith(orgId);
      // First dialog open call should be for the churn dialog (not the offboarding survey)
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("calls load() and returns when user accepts the offer", async () => {
      mockDialogService.open.mockReturnValue(
        makeDialogRef(ChurnMitigationOfferDialogResultType.Accepted) as any,
      );
      const loadSpy = jest.spyOn(component, "load" as any).mockResolvedValue(undefined);

      await component.cancelSubscription();

      expect(loadSpy).toHaveBeenCalled();
      // Only one dialog opened — the churn dialog; offboarding survey never opened
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("opens the offboarding survey when user declines the offer", async () => {
      mockDialogService.open
        .mockReturnValueOnce(makeDialogRef(ChurnMitigationOfferDialogResultType.Declined) as any)
        .mockReturnValueOnce(makeDialogRef("closed") as any);

      await component.cancelSubscription();

      expect(mockDialogService.open).toHaveBeenCalledTimes(2);
    });

    it("does not open offboarding survey when user closes the churn dialog without choosing", async () => {
      mockDialogService.open.mockReturnValue(
        makeDialogRef(ChurnMitigationOfferDialogResultType.Closed) as any,
      );

      await component.cancelSubscription();

      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("calls load() after the offboarding survey is submitted", async () => {
      mockDialogService.open
        .mockReturnValueOnce(makeDialogRef(ChurnMitigationOfferDialogResultType.Declined) as any)
        .mockReturnValueOnce(makeDialogRef("submitted") as any);
      const loadSpy = jest.spyOn(component, "load" as any).mockResolvedValue(undefined);

      await component.cancelSubscription();

      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe("ineligible org (no offer returned)", () => {
    beforeEach(() => {
      mockOrganizationBillingClient.getChurnOffer.mockResolvedValue(null);
    });

    it("opens the offboarding survey directly without opening the churn-offer dialog", async () => {
      mockDialogService.open.mockReturnValue(makeDialogRef("closed") as any);

      await component.cancelSubscription();

      expect(mockOrganizationBillingClient.getChurnOffer).toHaveBeenCalledWith(orgId);
      expect(mockDialogService.open).toHaveBeenCalledTimes(1);
    });

    it("calls load() when the offboarding survey is submitted", async () => {
      mockDialogService.open.mockReturnValue(makeDialogRef("submitted") as any);
      const loadSpy = jest.spyOn(component, "load" as any).mockResolvedValue(undefined);

      await component.cancelSubscription();

      expect(loadSpy).toHaveBeenCalled();
    });

    it("does not call load() when the offboarding survey is closed without submitting", async () => {
      mockDialogService.open.mockReturnValue(makeDialogRef("closed") as any);
      const loadSpy = jest.spyOn(component, "load" as any).mockResolvedValue(undefined);

      await component.cancelSubscription();

      expect(loadSpy).not.toHaveBeenCalled();
    });
  });
});
