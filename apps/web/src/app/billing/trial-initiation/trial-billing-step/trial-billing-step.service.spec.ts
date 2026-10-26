import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";
import { firstValueFrom, of, throwError } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationResponse } from "@bitwarden/common/admin-console/models/response/organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlanType } from "@bitwarden/common/billing/enums";
import { DiscountTierType } from "@bitwarden/common/billing/enums/discount-tier-type.enum";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { PreviewInvoiceClient } from "@bitwarden/web-vault/app/billing/clients";
import { InvoicePreviewService } from "@bitwarden/web-vault/app/billing/services/invoice-preview.service";
import { SubscriptionDiscountService } from "@bitwarden/web-vault/app/billing/services/subscription-discount.service";

import { TrialBillingStepService } from "./trial-billing-step.service";

describe("TrialBillingStepService", () => {
  const mockApiService = mock<ApiService>();
  const mockOrganizationBillingService = mock<OrganizationBillingServiceAbstraction>();
  const mockPreviewInvoiceClient = mock<PreviewInvoiceClient>();
  const mockInvoicePreviewService = mock<InvoicePreviewService>();
  const mockSubscriptionDiscountService = mock<SubscriptionDiscountService>();
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
  const mockEnterprisePlan = {
    type: PlanType.EnterpriseAnnually,
    productTier: 3,
    name: "Enterprise",
    isAnnual: true,
    PasswordManager: {
      basePrice: 0,
      seatPrice: 6,
      baseSeats: 0,
    },
    SecretsManager: null,
    PrivilegedControls: {
      seatPrice: 5,
      defaultSeatMinimum: 8,
      promotionalSeatMinimums: [4, 6],
    },
  } as unknown as PlanResponse;
  const mockEnterpriseMonthlyPlan = {
    type: PlanType.EnterpriseMonthly,
    productTier: 3,
    name: "Enterprise",
    isAnnual: false,
    PasswordManager: {
      basePrice: 0,
      seatPrice: 0.5,
      baseSeats: 0,
    },
    SecretsManager: null,
    PrivilegedControls: null,
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
    mockReset(mockInvoicePreviewService);
    mockReset(mockSubscriptionDiscountService);
    mockReset(mockAccountService);

    mockApiService.getPlans.mockResolvedValue({
      data: [mockFamiliesPlan, mockEnterprisePlan, mockEnterpriseMonthlyPlan],
    } as any);
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
        { provide: InvoicePreviewService, useValue: mockInvoicePreviewService },
        { provide: SubscriptionDiscountService, useValue: mockSubscriptionDiscountService },
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

      await sut.getCosts("passwordManager", "families", "annually", billingAddress, undefined, [
        "coupon-abc",
      ]);

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

      await sut.getCosts(
        "passwordManager",
        "families",
        "annually",
        billingAddress,
        undefined,
        undefined,
      );

      expect(
        mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ tier: "families" }),
        expect.anything(),
        undefined,
      );
    });

    it("includes Privileged Controls in the preview when provided", async () => {
      mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase.mockResolvedValue(
        mockCosts,
      );

      await sut.getCosts("passwordManager", "enterprise", "annually", billingAddress, {
        seatMinimum: 6,
      });

      expect(
        mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ privilegedControls: { seatMinimum: 6 } }),
        expect.anything(),
        undefined,
      );
    });

    it("omits Privileged Controls from the preview when not provided", async () => {
      mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase.mockResolvedValue(
        mockCosts,
      );

      await sut.getCosts("passwordManager", "enterprise", "annually", billingAddress);

      expect(
        mockPreviewInvoiceClient.previewTaxForOrganizationSubscriptionPurchase,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ privilegedControls: undefined }),
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

    it("subscribes to Privileged Controls at a seat minimum of 1", async () => {
      await sut.startTrial(
        { ...mockTrial, tier: "enterprise", privilegedControls: { seatMinimum: 6 } },
        "annually",
        billingAddress,
        paymentMethod,
      );

      expect(mockOrganizationBillingService.purchaseSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: expect.objectContaining({
            passwordManagerSeats: 1,
            subscribeToPrivilegedControls: true,
            pamSeatMinimum: 1,
          }),
        }),
        "user-id",
      );
    });

    it("does not subscribe to Privileged Controls when absent", async () => {
      await sut.startTrial(mockTrial, "annually", billingAddress, paymentMethod);

      const call = mockOrganizationBillingService.purchaseSubscription.mock.calls[0][0];
      expect(call.plan).not.toHaveProperty("subscribeToPrivilegedControls");
    });
  });

  describe("getPrices$", () => {
    it("returns the annual and monthly seat prices for the product and tier", async () => {
      const prices = await firstValueFrom(sut.getPrices$("passwordManager", "enterprise"));

      expect(prices).toEqual({ annually: 6, monthly: 0.5 });
    });
  });

  describe("previewPurchase", () => {
    const billingAddressControls = { country: "US", postalCode: "12345" } as any;
    const mockEnterpriseTrial = {
      organization: { name: "Test Org", email: "test@example.com" },
      product: "passwordManager" as const,
      tier: "enterprise" as const,
      length: 0,
    };

    it("previews the trial's one-seat purchase at the given cadence and address", async () => {
      const preview = { total: 104 } as any;
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(preview);

      const result = await sut.previewPurchase(
        mockEnterpriseTrial,
        "annually",
        billingAddressControls,
      );

      expect(result).toBe(preview);
      expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledWith({
        purchase: expect.objectContaining({
          tier: "enterprise",
          cadence: "annually",
          passwordManager: { seats: 1, additionalStorage: 0, sponsored: false },
          privilegedControls: undefined,
          secretsManager: undefined,
        }),
        billingAddress: expect.objectContaining({ country: "US", postalCode: "12345" }),
      });
    });

    it("adds the Secrets Manager block only for a Secrets Manager trial", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue({} as any);

      await sut.previewPurchase(
        { ...mockEnterpriseTrial, product: "secretsManager" },
        "annually",
        billingAddressControls,
      );

      const { purchase } =
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0][0];
      expect(purchase.secretsManager).toEqual({
        seats: 1,
        additionalServiceAccounts: 0,
        standalone: true,
      });
    });

    it("requests 1 PAM seat regardless of the link's seat minimum", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue({} as any);

      await sut.previewPurchase(
        { ...mockEnterpriseTrial, privilegedControls: { seatMinimum: 6 } },
        "annually",
        billingAddressControls,
      );

      const { purchase } =
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0][0];
      expect(purchase.privilegedControls).toEqual({ seatMinimum: 1 });
    });

    it("keeps the PM seat count at 1, never fewer than PAM seats", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue({} as any);

      await sut.previewPurchase(
        { ...mockEnterpriseTrial, privilegedControls: { seatMinimum: 6 } },
        "annually",
        billingAddressControls,
      );

      const { purchase } =
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0][0];
      expect(purchase.passwordManager.seats).toBe(1);
    });

    it("spreads coupons into the purchase when provided", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue({} as any);

      await sut.previewPurchase(mockEnterpriseTrial, "annually", billingAddressControls, [
        "coupon-1",
        "coupon-2",
      ]);

      const { purchase } =
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0][0];
      expect(purchase).toEqual(expect.objectContaining({ coupons: ["coupon-1", "coupon-2"] }));
    });

    it("omits coupons when none are provided", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue({} as any);

      await sut.previewPurchase(mockEnterpriseTrial, "annually", billingAddressControls);

      const { purchase } =
        mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0][0];
      expect(purchase).not.toHaveProperty("coupons");
    });
  });

  describe("getEligibleDiscounts$", () => {
    it("fetches discounts for the families tier", async () => {
      const discounts = [{ stripeCouponId: "coupon-1" }] as any[];
      mockSubscriptionDiscountService.getEligibleDiscountsForTier$.mockReturnValue(of(discounts));

      const result = await firstValueFrom(sut.getEligibleDiscounts$("families"));

      expect(result).toBe(discounts);
      expect(mockSubscriptionDiscountService.getEligibleDiscountsForTier$).toHaveBeenCalledWith(
        DiscountTierType.Families,
      );
    });

    it("returns no discounts for other tiers without fetching", async () => {
      const result = await firstValueFrom(sut.getEligibleDiscounts$("enterprise"));

      expect(result).toEqual([]);
      expect(mockSubscriptionDiscountService.getEligibleDiscountsForTier$).not.toHaveBeenCalled();
    });

    it("maps discount fetch failures to no discounts", async () => {
      mockSubscriptionDiscountService.getEligibleDiscountsForTier$.mockReturnValue(
        throwError(() => new Error("discount fetch failed")),
      );

      const result = await firstValueFrom(sut.getEligibleDiscounts$("families"));

      expect(result).toEqual([]);
    });
  });
});
