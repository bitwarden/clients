import { InvoicePreviewResponse } from "./invoice-preview.response";

describe("InvoicePreviewResponse", () => {
  const fullResponse = () => ({
    PasswordManager: {
      Seats: {
        Reference: "pm-seat",
        Quantity: 5,
        Cost: 50,
        Discounts: [{ Type: "percent-off", Value: 20, Amount: 50 }],
      },
      AdditionalStorage: { Reference: "pm-storage", Quantity: 2, Cost: 10 },
      Prorations: [{ Credit: 12.5, Charge: 30, Tax: 1.5, Total: 19, Months: 6 }],
    },
    SecretsManager: {
      Seats: { Reference: "sm-seat", Quantity: 3, Cost: 30 },
      AdditionalServiceAccounts: { Reference: "sm-service-account", Quantity: 4, Cost: 3 },
      Prorations: [{ Credit: 2, Charge: 5, Tax: 0.25, Total: 3.25, Months: 6 }],
    },
    Cadence: "monthly",
    PlanTier: "teams",
    Discounts: [{ Type: "amount-off", Value: 15, Amount: 15, Label: "Loyalty" }],
    StartingBalance: -250,
    EstimatedTax: 9.6,
    Total: 259.6,
    AmountDue: 9.6,
    NextPaymentAttempt: "2026-09-01T00:00:00.000Z",
  });

  describe("full parse", () => {
    it("should parse every field", () => {
      const response = new InvoicePreviewResponse(fullResponse());

      expect(response.passwordManager.seats).toMatchObject({
        reference: "pm-seat",
        quantity: 5,
        cost: 50,
      });
      expect(response.passwordManager.seats.discounts).toHaveLength(1);
      expect(response.passwordManager.seats.discounts![0]).toMatchObject({
        type: "percent-off",
        value: 20,
        amount: 50,
      });
      expect(response.passwordManager.seats.discounts![0].label).toBeUndefined();
      expect(response.passwordManager.additionalStorage).toMatchObject({
        reference: "pm-storage",
        quantity: 2,
        cost: 10,
      });
      expect(response.passwordManager.prorations).toHaveLength(1);
      expect(response.passwordManager.prorations![0]).toMatchObject({
        credit: 12.5,
        charge: 30,
        tax: 1.5,
        total: 19,
        months: 6,
      });

      expect(response.secretsManager!.seats).toMatchObject({ reference: "sm-seat" });
      expect(response.secretsManager!.additionalServiceAccounts).toMatchObject({
        reference: "sm-service-account",
      });
      expect(response.secretsManager!.prorations).toHaveLength(1);

      expect(response.cadence).toBe("monthly");
      expect(response.planTier).toBe("teams");
      expect(response.discounts).toHaveLength(1);
      expect(response.discounts![0]).toMatchObject({
        type: "amount-off",
        value: 15,
        amount: 15,
        label: "Loyalty",
      });
      expect(response.startingBalance).toBe(-250);
      expect(response.estimatedTax).toBe(9.6);
      expect(response.total).toBe(259.6);
      expect(response.amountDue).toBe(9.6);
      expect(response.nextPaymentAttempt).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    });
  });

  describe("optional branches", () => {
    const minimal = () => ({
      PasswordManager: { Seats: { Reference: "pm-seat", Quantity: 1, Cost: 10 } },
      Cadence: "annually",
      PlanTier: "premium",
      EstimatedTax: 0,
      Total: 10,
      AmountDue: 10,
    });

    it("should leave every optional field undefined when absent", () => {
      const response = new InvoicePreviewResponse(minimal());

      expect(response.secretsManager).toBeUndefined();
      expect(response.passwordManager.additionalStorage).toBeUndefined();
      expect(response.passwordManager.prorations).toBeUndefined();
      expect(response.passwordManager.seats.discounts).toBeUndefined();
      expect(response.discounts).toBeUndefined();
      expect(response.startingBalance).toBeUndefined();
      expect(response.nextPaymentAttempt).toBeUndefined();
    });

    it("should preserve a starting balance of zero rather than dropping it", () => {
      const response = new InvoicePreviewResponse({ ...minimal(), StartingBalance: 0 });

      expect(response.startingBalance).toBe(0);
    });

    it("should parse a secrets manager section without seats", () => {
      // A mid-cycle SM removal yields a section with proration credits but no recurring seat line.
      const response = new InvoicePreviewResponse({
        ...minimal(),
        SecretsManager: {
          Prorations: [{ Credit: 2, Charge: 0, Tax: 0, Total: -2, Months: 6 }],
        },
      });

      expect(response.secretsManager!.seats).toBeUndefined();
      expect(response.secretsManager!.prorations).toHaveLength(1);
    });

    it("should not set nextPaymentAttempt when the server omits it", () => {
      const response = new InvoicePreviewResponse({ ...minimal(), NextPaymentAttempt: null });

      expect(response.nextPaymentAttempt).toBeUndefined();
    });
  });

  describe("validation", () => {
    const base = () => ({
      PasswordManager: { Seats: { Reference: "pm-seat", Quantity: 1, Cost: 10 } },
      Cadence: "annually",
      PlanTier: "premium",
      EstimatedTax: 0,
      Total: 10,
      AmountDue: 10,
    });

    it("should throw on an invalid cadence", () => {
      expect(() => new InvoicePreviewResponse({ ...base(), Cadence: "weekly" })).toThrow(
        "Failed to parse invalid cadence: weekly",
      );
    });

    it("should throw on an invalid plan tier", () => {
      expect(() => new InvoicePreviewResponse({ ...base(), PlanTier: "free" })).toThrow(
        "Failed to parse invalid plan tier: free",
      );
    });

    it.each(["EstimatedTax", "Total", "AmountDue"])("should throw when %s is missing", (field) => {
      const json: Record<string, unknown> = { ...base() };
      delete json[field];

      expect(() => new InvoicePreviewResponse(json)).toThrow(
        `Failed to parse invoice preview: missing ${field}`,
      );
    });

    it("should preserve zeros for EstimatedTax, Total, and AmountDue rather than throwing", () => {
      // A fully-discounted cart is a real case; the guards are `== null`, not falsy, and a
      // tightening to `!field` would break free-cart previews at parse time.
      const response = new InvoicePreviewResponse({
        ...base(),
        EstimatedTax: 0,
        Total: 0,
        AmountDue: 0,
      });

      expect(response.estimatedTax).toBe(0);
      expect(response.total).toBe(0);
      expect(response.amountDue).toBe(0);
    });

    it("should throw when a discount is missing Amount", () => {
      // The preview contract's Amount is required — Stripe always computes an applied amount —
      // so its absence is a parse failure, not a degrade-to-derivation case.
      expect(
        () =>
          new InvoicePreviewResponse({
            ...base(),
            Discounts: [{ Type: "percent-off", Value: 20 }],
          }),
      ).toThrow("Failed to parse invoice preview discount: missing Amount");
    });

    it("should throw on an invalid discount type", () => {
      expect(
        () =>
          new InvoicePreviewResponse({
            ...base(),
            Discounts: [{ Type: "buy-one-get-one", Value: 20, Amount: 10 }],
          }),
      ).toThrow("Failed to parse invalid discount type: buy-one-get-one");
    });

    it("should preserve a discount Amount of zero rather than throwing", () => {
      // A fully-consumed coupon can legitimately apply $0; the guard is `== null`, not falsy.
      const response = new InvoicePreviewResponse({
        ...base(),
        Discounts: [{ Type: "amount-off", Value: 15, Amount: 0 }],
      });

      expect(response.discounts![0].amount).toBe(0);
    });

    it("should NOT throw on an unrecognized purchasable reference", () => {
      // Forward compatibility: the translation layer logs and renders an empty label instead.
      const response = new InvoicePreviewResponse({
        ...base(),
        PasswordManager: { Seats: { Reference: "pm-future", Quantity: 1, Cost: 10 } },
      });

      expect(response.passwordManager.seats.reference).toBe("pm-future");
    });
  });
});
