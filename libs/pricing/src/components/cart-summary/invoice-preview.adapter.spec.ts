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
        translationKey: "additionalStorageGbLower",
        quantity: 2,
        cost: 10,
      });
      expect(cart.secretsManager!.seats).toEqual({
        translationKey: "secretsManagerPlanPrice",
        quantity: 3,
        cost: 30,
      });
      expect(cart.secretsManager!.additionalServiceAccounts).toEqual({
        translationKey: "additionalServiceAccountsLower",
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
        translationKey: "additionalServiceAccountsLower",
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
      [InvoicePreviewFlowContext.OrganizationSubscriptionPage, "appliedSubscriptionCredits"],
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

    describe("subscription page", () => {
      it("should render a seatless transition invoice's charge as its own line", () => {
        // The server emits no seat line when the invoice is all prorations; the charge renders
        // as its own line under the Password Manager section.
        const preview = basePreview({
          passwordManager: {
            prorations: [{ credit: 37.64, charge: 188.22, tax: 12.05, total: 150.58, months: 6 }],
          },
          planTier: "enterprise",
        });

        const cart = adaptInvoicePreviewToCart(
          preview,
          InvoicePreviewFlowContext.OrganizationSubscriptionPage,
          logService,
        );

        expect(cart.passwordManager.seats).toBeUndefined();
        expect(cart.passwordManager.prorationCharges).toEqual([
          {
            translationKey: "passwordManagerProratedCharge",
            quantity: 1,
            cost: 188.22,
            hideBreakdown: true,
          },
        ]);
        expect(cart.credit).toEqual({
          translationKey: "appliedSubscriptionCredits",
          value: 37.64,
        });
        expect(cart.hidePricingTerm).toBe(true);
      });

      it("should render a single seat with the singular unit", () => {
        const preview = basePreview({
          passwordManager: { seats: { reference: "pm-seat", quantity: 1, cost: 48 } },
          planTier: "teams",
        });

        const cart = adaptInvoicePreviewToCart(
          preview,
          InvoicePreviewFlowContext.OrganizationSubscriptionPage,
          logService,
        );

        expect(cart.passwordManager.seats!.translationKey).toBe("memberLower");
      });

      it("should render charged prorations as their own lines beside a real seat line", () => {
        // Renewal + mid-cycle change: the seat line is the per-unit renewal price, so the
        // proration charge cannot merge into it.
        const preview = basePreview({
          passwordManager: {
            seats: { reference: "pm-seat", quantity: 3, cost: 48 },
            additionalStorage: { reference: "pm-storage", quantity: 5, cost: 3 },
            prorations: [
              {
                reference: "pm-seat",
                credit: 9.02,
                charge: 13.52,
                tax: 0.36,
                total: 4.5,
                months: 1,
              },
            ],
          },
          planTier: "teams",
        });

        const cart = adaptInvoicePreviewToCart(
          preview,
          InvoicePreviewFlowContext.OrganizationSubscriptionPage,
          logService,
        );

        expect(cart.passwordManager.seats).toEqual({
          translationKey: "membersLower",
          quantity: 3,
          cost: 48,
        });
        expect(cart.passwordManager.prorationCharges).toEqual([
          {
            translationKey: "passwordManagerProratedCharge",
            quantity: 1,
            cost: 13.52,
            hideBreakdown: true,
          },
        ]);
        expect(cart.credit).toEqual({
          translationKey: "appliedSubscriptionCredits",
          value: 9.02,
        });
        expect(cart.hidePricingTerm).toBeUndefined();
      });

      it("should emit no charge lines for a pure-credit proration", () => {
        const preview = basePreview({
          passwordManager: {
            seats: { reference: "pm-seat", quantity: 3, cost: 48 },
            prorations: [
              {
                reference: "pm-seat",
                credit: 9.02,
                charge: 0,
                tax: 0,
                total: -9.02,
                months: 1,
              },
            ],
          },
          planTier: "teams",
        });

        const cart = adaptInvoicePreviewToCart(
          preview,
          InvoicePreviewFlowContext.OrganizationSubscriptionPage,
          logService,
        );

        expect(cart.passwordManager.prorationCharges).toBeUndefined();
        expect(cart.credit).toEqual({
          translationKey: "appliedSubscriptionCredits",
          value: 9.02,
        });
      });
    });

    it.each([
      InvoicePreviewFlowContext.PremiumSubscriptionPage,
      InvoicePreviewFlowContext.PersonalCheckout,
      InvoicePreviewFlowContext.OrganizationCheckout,
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

  describe("proration-only password manager", () => {
    it("should derive the seat row from the prorated charge when the preview has no seats line", () => {
      const preview = basePreview({
        planTier: "enterprise",
        passwordManager: {
          prorations: [{ credit: 6.67, charge: 26.67, tax: 2, total: 20, months: 8 }],
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.passwordManager.seats).toEqual({
        translationKey: "enterpriseMembership",
        quantity: 1,
        cost: 26.67,
        hideBreakdown: true,
      });
      expect(cart.credit).toEqual({ translationKey: "premiumSubscriptionCredit", value: 6.67 });
    });

    it("should sum multiple prorated charges in integer cents", () => {
      const preview = basePreview({
        passwordManager: {
          prorations: [
            { credit: 0, charge: 0.1, tax: 0, total: 0.1, months: 1 },
            { credit: 0, charge: 0.1, tax: 0, total: 0.1, months: 1 },
            { credit: 0, charge: 0.1, tax: 0, total: 0.1, months: 1 },
          ],
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.passwordManager.seats!.cost).toBe(0.3);
    });

    it("should emit no seat line when the preview has neither a seats line nor a proration", () => {
      // The server enforces the seats-or-proration invariant; the client keeps the seat line
      // optional rather than throwing on a shape it should never receive.
      const cart = adaptInvoicePreviewToCart(
        basePreview({ passwordManager: {} }),
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.passwordManager.seats).toBeUndefined();
    });

    it("should emit no seat line for a credit-only proration group without a seats line", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({
          passwordManager: {
            prorations: [{ credit: 5, charge: 0, tax: 0, total: -5, months: 3 }],
          },
        }),
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.passwordManager.seats).toBeUndefined();
      expect(cart.credit).toEqual({ translationKey: "premiumSubscriptionCredit", value: 5 });
    });

    it("should derive a Secrets Manager seat line from its charge on a seat-line placement", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({
          planTier: "teams",
          passwordManager: { seats: { reference: "pm-seat", quantity: 3, cost: 48 } },
          secretsManager: {
            prorations: [{ credit: 2, charge: 18, tax: 0, total: 16, months: 6 }],
          },
        }),
        InvoicePreviewFlowContext.OrganizationPlanChange,
        logService,
      );

      expect(cart.secretsManager!.seats).toEqual({
        translationKey: "secretsManagerPlanPrice",
        quantity: 1,
        cost: 18,
        hideBreakdown: true,
      });
      expect(cart.secretsManager!.prorationCharges).toBeUndefined();
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

  describe("applied balance, amount due, and total", () => {
    it("maps a gross total, amountDue, and a negative starting balance to appliedBalance", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 14.54, amountDue: 1.58, startingBalance: -12.96 }),
        InvoicePreviewFlowContext.PremiumSubscriptionPage,
        logService,
      );

      expect(cart.total).toBe(14.54);
      expect(cart.amountDue).toBe(1.58);
      expect(cart.appliedBalance).toBe(12.96);
    });

    it("omits appliedBalance when there is no negative starting balance", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 14.54, amountDue: 14.54, startingBalance: 5 }),
        InvoicePreviewFlowContext.PremiumSubscriptionPage,
        logService,
      );

      expect(cart.appliedBalance).toBeUndefined();
      expect(cart.amountDue).toBe(14.54);
      expect(cart.total).toBe(14.54);
    });

    it("does not emit an accountCredit field", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 14.54, amountDue: 1.58, startingBalance: -12.96 }),
        InvoicePreviewFlowContext.PremiumSubscriptionPage,
        logService,
      );

      expect("accountCredit" in cart).toBe(false);
    });

    it("caps appliedBalance at the invoice total when the balance exceeds it", () => {
      // Only $12 of the $500 balance is consumed; appliedBalance is what was applied
      // (total - amountDue), not the whole balance, so Total - Applied balance = Amount due.
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 12, amountDue: 0, startingBalance: -500 }),
        InvoicePreviewFlowContext.PremiumSubscriptionPage,
        logService,
      );

      expect(cart.appliedBalance).toBe(12);
    });

    it("emits a proration credit row and an applied balance as independent values", () => {
      // A subscription-page invoice with a pure-credit proration (cart.credit) and a $10 account
      // balance consumed this cycle (cart.appliedBalance): the two are distinct rows and must not
      // merge or double-count.
      const cart = adaptInvoicePreviewToCart(
        basePreview({
          passwordManager: {
            seats: { reference: "pm-seat", quantity: 1, cost: 40 },
            prorations: [{ credit: 6.67, charge: 0, tax: 0, total: -6.67, months: 8 }],
          },
          total: 33.33,
          amountDue: 23.33,
          startingBalance: -10,
        }),
        InvoicePreviewFlowContext.OrganizationSubscriptionPage,
        logService,
      );

      expect(cart.credit).toEqual({ translationKey: "appliedSubscriptionCredits", value: 6.67 });
      expect(cart.appliedBalance).toBe(10);
    });

    it("sums appliedBalance in integer cents so fractional amounts do not drift", () => {
      // total - amountDue is 0.3 - 0.1, which is 0.19999999999999998 in float arithmetic.
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 0.3, amountDue: 0.1, startingBalance: -0.2 }),
        InvoicePreviewFlowContext.PremiumSubscriptionPage,
        logService,
      );

      expect(cart.appliedBalance).toBe(0.2);
    });
  });

  describe("total and tax", () => {
    it("should map the gross invoice total alongside the amount due", () => {
      // A customer carrying $50 of account credit: Stripe reports total 412.75, amountDue 362.75.
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 412.75, amountDue: 362.75, startingBalance: -50 }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.total).toBe(412.75);
      expect(cart.amountDue).toBe(362.75);
    });

    it("should pass an amount due of zero through rather than dropping it", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ total: 12, amountDue: 0 }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(cart.amountDue).toBe(0);
      expect(cart.total).toBe(12);
    });
  });

  describe("fields that are deliberately not mapped", () => {
    it("should not map startingBalance onto the cart as its own field", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ startingBalance: -500 }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(Object.keys(cart)).not.toContain("startingBalance");
      expect((cart as Record<string, unknown>).startingBalance).toBeUndefined();
    });

    it("should not map nextPaymentAttempt onto the cart as its own field", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ nextPaymentAttempt: new Date("2026-01-01") }),
        InvoicePreviewFlowContext.OrganizationCheckout,
        logService,
      );

      expect(Object.keys(cart)).not.toContain("nextPaymentAttempt");
    });
  });

  describe("prorated seat label", () => {
    const proratedPreview = () =>
      basePreview({
        planTier: "families",
        passwordManager: {
          prorations: [{ credit: 6.67, charge: 26.67, tax: 2, total: 20, months: 8 }],
        },
      });

    it("should label the seat line with the plan name and prorated month count", () => {
      const cart = adaptInvoicePreviewToCart(
        proratedPreview(),
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
        { planName: "Families" },
      );

      expect(cart.passwordManager.seats).toEqual({
        translationKey: "planProratedMembershipInMonths",
        translationParams: ["Families", "8 months"],
        quantity: 1,
        cost: 26.67,
        hideBreakdown: true,
      });
    });

    it("should use the singular month label for a single prorated month", () => {
      const preview = basePreview({
        planTier: "families",
        passwordManager: {
          prorations: [{ credit: 1, charge: 3.33, tax: 0, total: 2.33, months: 1 }],
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
        { planName: "Families" },
      );

      expect(cart.passwordManager.seats!.translationParams).toEqual(["Families", "1 month"]);
    });

    it("should also relabel a real seats line when the group is prorated", () => {
      const preview = basePreview({
        planTier: "teams",
        passwordManager: {
          seats: { reference: "pm-seat", quantity: 1, cost: 26.67 },
          prorations: [{ credit: 6.67, charge: 26.67, tax: 2, total: 20, months: 8 }],
        },
      });

      const cart = adaptInvoicePreviewToCart(
        preview,
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
        { planName: "Teams" },
      );

      expect(cart.passwordManager.seats!.translationKey).toBe("planProratedMembershipInMonths");
      expect(cart.passwordManager.seats!.translationParams).toEqual(["Teams", "8 months"]);
    });

    it("should keep the plain membership label when no plan name is supplied", () => {
      const cart = adaptInvoicePreviewToCart(
        proratedPreview(),
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
      );

      expect(cart.passwordManager.seats.translationKey).toBe("familiesMembership");
      expect(cart.passwordManager.seats.translationParams).toBeUndefined();
    });

    it("should keep the plain membership label when the preview carries no prorated months", () => {
      const cart = adaptInvoicePreviewToCart(
        basePreview({ planTier: "families" }),
        InvoicePreviewFlowContext.PremiumOrgUpgrade,
        logService,
        { planName: "Families" },
      );

      expect(cart.passwordManager.seats.translationKey).toBe("familiesMembership");
      expect(cart.passwordManager.seats.translationParams).toBeUndefined();
    });

    it("should ignore the plan name in flow contexts that do not label prorated seats", () => {
      const cart = adaptInvoicePreviewToCart(
        proratedPreview(),
        InvoicePreviewFlowContext.PersonalCheckout,
        logService,
        { planName: "Families" },
      );

      expect(cart.passwordManager.seats.translationKey).toBe("familiesMembership");
      expect(cart.passwordManager.seats.translationParams).toBeUndefined();
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
