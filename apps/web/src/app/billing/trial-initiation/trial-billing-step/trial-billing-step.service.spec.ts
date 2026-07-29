import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlanType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { PreviewInvoiceClient } from "@bitwarden/web-vault/app/billing/clients";

import { TrialBillingStepService } from "./trial-billing-step.service";

describe("TrialBillingStepService", () => {
  const mockApiService = mock<ApiService>();
  const mockOrganizationBillingService = mock<OrganizationBillingServiceAbstraction>();
  const mockPreviewInvoiceClient = mock<PreviewInvoiceClient>();
  const mockAccountService = mock<AccountService>();
  const mockFamiliesPlan = {
    type: PlanType.FamiliesAnnually,
    productTier: 4,
    name: "Families",
    isAnnual: true,
    PasswordManager: {
      basePrice: 40,
      seatPrice: 0,
      baseSeats: 6,
    },
    SecretsManager: null,
  } as unknown as PlanResponse;

  const mockAccount = {
    id: "user-id" as UserId,
    ...mockAccountInfoWith({ email: "test@example.com" }),
  };

  let sut: TrialBillingStepService;

  beforeEach(() => {
    mockReset(mockApiService);
    mockReset(mockOrganizationBillingService);
    mockReset(mockPreviewInvoiceClient);
    mockReset(mockAccountService);

    mockApiService.getPlans.mockResolvedValue({ data: [mockFamiliesPlan] } as any);
    mockAccountService.activeAccount$ = of(mockAccount as any);

    TestBed.configureTestingModule({
      providers: [
        TrialBillingStepService,
        { provide: ApiService, useValue: mockApiService },
        {
          provide: OrganizationBillingServiceAbstraction,
          useValue: mockOrganizationBillingService,
        },
        { provide: PreviewInvoiceClient, useValue: mockPreviewInvoiceClient },
        { provide: AccountService, useValue: mockAccountService },
      ],
    });

    sut = TestBed.inject(TrialBillingStepService);
  });

  describe("getCosts", () => {
    const billingAddress = { country: "US", postalCode: "12345" } as any;
    const mockCosts = { tax: 2.5, total: 42.5 };

    it("passes coupons to previewTaxForOrganizationSubscriptionPurchase when provided", async () => {
      mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase.mockResolvedValue(
        mockCosts,
      );

      await sut.getCosts("passwordManager", "families", "annually", billingAddress, ["coupon-abc"]);

      expect(
        mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase,
      ).toHaveBeenCalledWith(expect.objectContaining({ tier: "families" }), expect.anything(), [
        "coupon-abc",
      ]);
    });

    it("omits coupons from previewTaxForOrganizationSubscriptionPurchase when undefined", async () => {
      mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase.mockResolvedValue(
        mockCosts,
      );

      await sut.getCosts("passwordManager", "families", "annually", billingAddress, undefined);

      expect(
        mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ tier: "families" }),
        expect.anything(),
        undefined,
      );
    });
  });

  describe("startTrial", () => {
    const billingAddress = { country: "US", postalCode: "12345" } as any;
    const paymentMethod = { token: "tok_test", type: "card" } as any;
    const mockTrial = {
      organization: { name: "Test Org", email: "test@example.com" },
      product: "passwordManager" as const,
      tier: "families" as const,
      length: 0,
    };
    const mockOrgResponse = { id: "org-123" } as OrganizationResponse;

    beforeEach(() => {
      mockOrganizationBillingService.purchaseSubscription.mockResolvedValue(mockOrgResponse);
    });

    it("includes coupons in SubscriptionInformation when provided", async () => {
      await sut.startTrial(mockTrial, "annually", billingAddress, paymentMethod, ["coupon-xyz"]);

      expect(mockOrganizationBillingService.purchaseSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ coupons: ["coupon-xyz"] }),
        "user-id",
      );
    });

    it("omits coupons from SubscriptionInformation when not provided", async () => {
      await sut.startTrial(mockTrial, "annually", billingAddress, paymentMethod, undefined);

      const call = mockOrganizationBillingService.purchaseSubscription.mock.calls[0][0];
      expect(call).not.toHaveProperty("coupons");
    });
  });
});
