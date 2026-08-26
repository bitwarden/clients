import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { DiscountTypes } from "../../types/discount";
import { InvoicePreview, PurchasableReference } from "../../types/invoice-preview";

import { InvoicePreviewFlowContext } from "./invoice-preview-flow-context";
import { adaptInvoicePreviewToCart } from "./invoice-preview.adapter";

describe("adaptInvoicePreviewToCart", () => {
  let logService: LogService;

  beforeEach(() => {
    logService = mock<LogService>();
  });

  const basePreview = (overrides: Partial<InvoicePreview> = {}): InvoicePreview => ({
    passwordManager: {
      seats: { reference: "pm-seat", quantity: 5, cost: 50 },
    },
    cadence: "monthly",
    planTier: "teams",
    estimatedTax: 9.6,
    total: 259.6,
    amountDue: 259.6,
    ...overrides,
  });

  describe("shape mapping", () => {
    it("should map a Password-Manager-only preview", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview(),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.passwordManager.seats).toEqual({
        translationKey: "passwordManagerPlanPrice",
        quantity: 5,
        cost: 50,
      });
      expect(cart.passwordManager.additionalStorage).toBeUndefined();
      expect(cart.secretsManager).toBeUndefined();
      expect(cart.cadence).toBe("monthly");
      expect(cart.estimatedTax).toBe(9.6);
    });

    it("should map a full four-line preview", () => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          additionalStorage: { reference: "pm-storage", quantity: 2, cost: 10 },
        },
        secretsManager: {
          seats: { reference: "sm-seat", quantity: 3, cost: 30 },
          additionalServiceAccounts: {
            reference: "sm-service-account",
            quantity: 4,
            cost: 3,
          },
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.passwordManager.seats.translationKey).toBe("passwordManagerPlanPrice");
      expect(cart.passwordManager.additionalStorage).toEqual({
        translationKey: "additionalStorageGb",
        quantity: 2,
        cost: 10,
      });
      expect(cart.secretsManager!.seats).toEqual({
        translationKey: "secretsManagerPlanPrice",
        quantity: 3,
        cost: 30,
      });
      expect(cart.secretsManager!.additionalServiceAccounts).toEqual({
        translationKey: "additionalServiceAccounts",
        quantity: 4,
        cost: 3,
      });
    });

    it("should map a secrets manager section with service accounts but no seats", () => {
      const preview = basePreview({
        secretsManager: {
          additionalServiceAccounts: { reference: "sm-service-account", quantity: 4, cost: 3 },
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.secretsManager!.seats).toBeUndefined();
      expect(cart.secretsManager!.additionalServiceAccounts).toEqual({
        translationKey: "additionalServiceAccounts",
        quantity: 4,
        cost: 3,
      });
    });

    it("should omit a secrets manager section that has no line items", () => {
      // A mid-cycle SM removal leaves a section with only proration credits and nothing to render.
      const preview = basePreview({
        secretsManager: {
          prorations: [{ credit: 2, charge: 0, tax: 0, total: -2, months: 6 }],
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.secretsManager).toBeUndefined();
    });

    it("should pass quantity and cost through unchanged", () => {
      const preview = basePreview({
        passwordManager: { seats: { reference: "pm-seat", quantity: 7, cost: 12.34 } },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.passwordManager.seats.quantity).toBe(7);
      expect(cart.passwordManager.seats.cost).toBe(12.34);
    });
  });

  describe("proration collapse", () => {
    const prorated = (credits: number[]) =>
      credits.map((credit) => ({ credit, charge: 0, tax: 0, total: 0, months: 1 }));

    it("should collapse multiple prorations into exactly one credit row", () => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: prorated([10, 5]),
        },
        secretsManager: {
          seats: { reference: "sm-seat", quantity: 3, cost: 30 },
          prorations: prorated([2.5]),
        },
        planTier: "enterprise",
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.credit).toEqual({
        translationKey: "premiumSubscriptionCredit",
        value: 17.5,
      });
    });

    it("should sum a seats-less secrets manager section's prorations into the credit row", () => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: prorated([10]),
        },
        secretsManager: {
          prorations: prorated([2.5]),
        },
        planTier: "enterprise",
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.secretsManager).toBeUndefined();
      expect(cart.credit).toEqual({
        translationKey: "premiumSubscriptionCredit",
        value: 12.5,
      });
    });

    it("should sum in integer cents so fractional credits do not drift", () => {
      // 0.1 + 0.1 + 0.1 is 0.30000000000000004 in float arithmetic.
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: prorated([0.1, 0.1, 0.1]),
        },
        planTier: "enterprise",
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.credit!.value).toBe(0.3);
    });

    it("should emit no credit row when the summed credit is zero", () => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: prorated([0]),
        },
        planTier: "enterprise",
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.credit).toBeUndefined();
    });

    it.each([
      [InvoicePreviewFlowContext.PremiumOrgUpgrade, "premiumSubscriptionCredit"],
      [InvoicePreviewFlowContext.OrganizationPlanChange, "appliedSubscriptionCredits"],
    ])("should emit a credit row for %s", (flowContext, expectedKey) => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: prorated([25]),
        },
        planTier: "enterprise",
      });

      const cart = adaptInvoicePreviewToCart(preview, flowContext, logService);

      expect(cart.credit).toEqual({ translationKey: expectedKey, value: 25 });
    });

    it.each([
      InvoicePreviewFlowContext.PremiumSubscriptionPage,
      InvoicePreviewFlowContext.PersonalCheckout,
      InvoicePreviewFlowContext.OrganizationCheckout,
      InvoicePreviewFlowContext.OrganizationSubscriptionPage,
    ])("should emit no credit row for %s even when prorations exist", (flowContext) => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: prorated([25]),
        },
        planTier: "families",
      });

      const cart = adaptInvoicePreviewToCart(preview, flowContext, logService);

      expect(cart.credit).toBeUndefined();
    });
  });

  describe("hideBreakdown", () => {
    const proration = { credit: 10, charge: 0, tax: 0, total: 0, months: 1 };

    it("should set hideBreakdown on the seat line of a prorated group only", () => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          additionalStorage: { reference: "pm-storage", quantity: 2, cost: 10 },
          prorations: [proration],
        },
        planTier: "enterprise",
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.passwordManager.seats.hideBreakdown).toBe(true);
      expect(cart.passwordManager.additionalStorage!.hideBreakdown).toBeUndefined();
    });

    it("should apply hideBreakdown independently per product group", () => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: [proration],
        },
        secretsManager: {
          seats: { reference: "sm-seat", quantity: 3, cost: 30 },
        },
        planTier: "enterprise",
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.passwordManager.seats.hideBreakdown).toBe(true);
      expect(cart.secretsManager!.seats.hideBreakdown).toBeUndefined();
    });

    it("should not set hideBreakdown when the group has an empty prorations array", () => {
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50 },
          prorations: [],
        },
        planTier: "enterprise",
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.passwordManager.seats.hideBreakdown).toBeUndefined();
    });
  });

  describe("discount pass-through", () => {
    it("should carry no discounts key when the item has none", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview(),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.passwordManager.seats.discounts).toBeUndefined();
      expect(cart.discounts).toBeUndefined();
    });

    it("should pass a single per-line discount through with amount and label intact", () => {
      const preview = basePreview({
        passwordManager: {
          seats: {
            reference: "pm-seat",
            quantity: 5,
            cost: 50,
            discounts: [
              { type: DiscountTypes.PercentOff, value: 20, amount: 50, label: "Launch promo" },
            ],
          },
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.passwordManager.seats.discounts).toEqual([
        { type: DiscountTypes.PercentOff, value: 20, amount: 50, label: "Launch promo" },
      ]);
    });

    it("should pass multiple per-line discounts through in order", () => {
      const discounts = [
        { type: DiscountTypes.PercentOff, value: 20, amount: 50 },
        { type: DiscountTypes.AmountOff, value: 15, amount: 15, label: "Loyalty" },
      ];
      const preview = basePreview({
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 5, cost: 50, discounts },
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.passwordManager.seats.discounts).toEqual(discounts);
    });

    it("should map top-level discounts onto cart.discounts", () => {
      const discounts = [{ type: DiscountTypes.PercentOff, value: 10, amount: 25 }];
      const cart = adaptInvoicePreviewToCart(
        basePreview({ discounts }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.discounts).toEqual(discounts);
    });
  });

  describe("total and tax", () => {
    it("should pass the authoritative total through", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 412.75 }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.total).toBe(412.75);
    });

    it("should pass a total of zero through rather than dropping it", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 0 }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.total).toBe(0);
    });
  });

  describe("fields that are deliberately not mapped", () => {
    it("should not map startingBalance onto the cart", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ startingBalance: -500 }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(Object.keys(cart)).not.toContain("startingBalance");
      expect((cart as Record<string, unknown>).startingBalance).toBeUndefined();
    });

    it("should not map amountDue or nextPaymentAttempt onto the cart", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ amountDue: 123, nextPaymentAttempt: new Date("2026-01-01") }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(Object.keys(cart)).not.toContain("amountDue");
      expect(Object.keys(cart)).not.toContain("nextPaymentAttempt");
    });
  });

  describe("defensive behavior", () => {
    it("should log and not throw when a reference falls outside the union", () => {
      const preview = basePreview({
        passwordManager: {
          seats: {
            reference: "pm-unknown" as PurchasableReference,
            quantity: 1,
            cost: 10,
          },
        },
      });

      let cart!: ReturnType<typeof adaptInvoicePreviewToCart>;
      expect(() => {
        cart = adaptInvoicePreviewToCart(
          preview,
          InvoicePreviewFlowContext.OrganizationCheckout,
          logService,
        );
      }).not.toThrow();

      expect(cart.passwordManager.seats.translationKey).toBe("");
      expect(logService.error).toHaveBeenCalled();
    });
  });
});
