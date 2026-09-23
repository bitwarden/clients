import { TestBed } from "@angular/core/testing";
import { mock, mockReset } from "jest-mock-extended";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { Cart } from "@bitwarden/pricing";

import { OrganizationSubscriptionPurchase } from "../../clients";
import { BillingAddress } from "../../payment/types";
import { InvoicePreviewService } from "../../services/invoice-preview.service";

import { OrganizationCheckoutPreviewService } from "./organization-checkout-preview.service";

describe("OrganizationCheckoutPreviewService", () => {
  const mockInvoicePreviewService = mock<InvoicePreviewService>();

  let sut: OrganizationCheckoutPreviewService;

  const billingAddress: BillingAddress = {
    country: "US",
    postalCode: "12345",
    line1: null,
    line2: null,
    city: null,
    state: null,
    taxId: null,
  };

  const cart = { total: 31.6 } as unknown as Cart;

  const purchase: OrganizationSubscriptionPurchase = {
    tier: "teams",
    cadence: "monthly",
    passwordManager: { seats: 4, additionalStorage: 2, sponsored: false },
    secretsManager: { seats: 4, additionalServiceAccounts: 3, standalone: false },
  };

  beforeEach(() => {
    mockReset(mockInvoicePreviewService);

    TestBed.configureTestingModule({
      providers: [{ provide: InvoicePreviewService, useValue: mockInvoicePreviewService }],
    });

    sut = TestBed.inject(OrganizationCheckoutPreviewService);
  });

  describe("previewCheckoutCart", () => {
    it("should nest the purchase under `purchase` alongside the billing address", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(cart);

      const result = await sut.previewCheckoutCart(purchase, billingAddress, []);

      expect(mockInvoicePreviewService.previewOrganizationCheckoutCart).toHaveBeenCalledWith({
        purchase: {
          tier: "teams",
          cadence: "monthly",
          passwordManager: { seats: 4, additionalStorage: 2, sponsored: false },
          secretsManager: { seats: 4, additionalServiceAccounts: 3, standalone: false },
        },
        billingAddress,
      });
      expect(result).toBe(cart);
    });

    it("should include coupons when eligibility returned some", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(cart);

      await sut.previewCheckoutCart(purchase, billingAddress, ["SAVE20"]);

      const request = mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0]![0]!;
      expect(request.purchase.coupons).toEqual(["SAVE20"]);
    });

    it("should omit `coupons` entirely when there are none", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(cart);

      await sut.previewCheckoutCart(purchase, billingAddress, []);

      const request = mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0]![0]!;
      expect("coupons" in request.purchase).toBe(false);
    });

    it("should omit `secretsManager` entirely when Secrets Manager is not being purchased", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(cart);

      await sut.previewCheckoutCart({ ...purchase, secretsManager: undefined }, billingAddress, []);

      const request = mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0]![0]!;
      expect(request.purchase.secretsManager).toBeUndefined();
    });

    it("should carry the sponsorship signal through untouched", async () => {
      mockInvoicePreviewService.previewOrganizationCheckoutCart.mockResolvedValue(cart);

      await sut.previewCheckoutCart(
        {
          tier: "families",
          cadence: "annually",
          passwordManager: { seats: 1, additionalStorage: 0, sponsored: true },
        },
        billingAddress,
        [],
      );

      const request = mockInvoicePreviewService.previewOrganizationCheckoutCart.mock.calls[0]![0]!;
      expect(request.purchase.passwordManager.sponsored).toBe(true);
    });
  });

  describe("previewPremiumUpgradeCart", () => {
    it("should forward the target tier, the trimmed address and the plan name", async () => {
      mockInvoicePreviewService.previewPremiumOrgUpgradeCart.mockResolvedValue(cart);

      const result = await sut.previewPremiumUpgradeCart(
        ProductTierType.Teams,
        billingAddress,
        "Teams",
      );

      expect(mockInvoicePreviewService.previewPremiumOrgUpgradeCart).toHaveBeenCalledWith(
        {
          targetProductTierType: ProductTierType.Teams,
          billingAddress: { country: "US", postalCode: "12345" },
        },
        "Teams",
      );
      expect(result).toBe(cart);
    });
  });
});
