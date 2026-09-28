import type { Cart } from "@bitwarden/pricing";

import { SubscriptionPreviewResponse } from "./subscription-preview.response";

describe("SubscriptionPreviewResponse", () => {
  const invoicePreviewJson = {
    PasswordManager: { Seats: { Reference: "pm-seat", Quantity: 1, Cost: 10 } },
    Cadence: "annually",
    PlanTier: "premium",
    EstimatedTax: 0,
    Total: 10,
    AmountDue: 10,
    NextPaymentAttempt: "2026-06-01T00:00:00.000Z",
  };

  const responseJson = (overrides: Record<string, unknown> = {}) => ({
    Status: "active",
    InvoicePreview: invoicePreviewJson,
    Storage: { Available: 5, Used: 1, ReadableUsed: "1 GB" },
    ...overrides,
  });

  // The facade adapts the parsed InvoicePreview before calling toDomain; the adapted cart is opaque
  // to the DTO, so a simple stand-in is sufficient here.
  const adaptedCart: Cart = {
    passwordManager: { seats: { translationKey: "premiumMembership", quantity: 1, cost: 10 } },
    cadence: "annually",
    estimatedTax: 0,
  };

  describe("parsing", () => {
    it("should parse the invoice preview via InvoicePreviewResponse", () => {
      const response = new SubscriptionPreviewResponse(responseJson());

      expect(response.invoicePreview.planTier).toBe("premium");
      expect(response.invoicePreview.passwordManager.seats.reference).toBe("pm-seat");
    });

    it("should parse storage when present", () => {
      const response = new SubscriptionPreviewResponse(responseJson());

      expect(response.storage).toMatchObject({ available: 5, used: 1, readableUsed: "1 GB" });
    });

    it("should preserve a grace period of zero rather than dropping it", () => {
      const response = new SubscriptionPreviewResponse(
        responseJson({
          Status: "past_due",
          Suspension: "2026-03-01T00:00:00.000Z",
          GracePeriod: 0,
        }),
      );

      expect(response.gracePeriod).toBe(0);
    });

    it("should leave storage undefined when the server omits it", () => {
      const response = new SubscriptionPreviewResponse(responseJson({ Storage: null }));

      expect(response.storage).toBeUndefined();
    });

    it("should throw on an invalid status", () => {
      expect(() => new SubscriptionPreviewResponse(responseJson({ Status: "bogus" }))).toThrow(
        "Failed to parse invalid subscription status: bogus",
      );
    });

    it.each(["incomplete", "incomplete_expired"])(
      "should throw when a %s response omits the suspension details the server always emits",
      (status) => {
        expect(() => new SubscriptionPreviewResponse(responseJson({ Status: status }))).toThrow(
          `Failed to parse missing suspension details for subscription status: ${status}`,
        );
      },
    );

    it.each(["past_due", "unpaid"])(
      "should parse a %s response without suspension details rather than throwing",
      (status) => {
        // The server derives suspension from open overdue invoices and legitimately returns
        // nothing when none qualify (e.g. the invoice was paid before the status webhook landed).
        const response = new SubscriptionPreviewResponse(responseJson({ Status: status }));

        expect(response.suspension).toBeUndefined();
        expect(response.gracePeriod).toBeUndefined();
      },
    );

    it("should parse a past_due response with a suspension date but no grace period", () => {
      const response = new SubscriptionPreviewResponse(
        responseJson({ Status: "past_due", Suspension: "2026-03-01T00:00:00.000Z" }),
      );

      expect(response.suspension).toEqual(new Date("2026-03-01T00:00:00.000Z"));
      expect(response.gracePeriod).toBeUndefined();
    });

    it("should throw when a canceled response omits the canceled date", () => {
      expect(() => new SubscriptionPreviewResponse(responseJson({ Status: "canceled" }))).toThrow(
        "Failed to parse missing canceled date for canceled subscription",
      );
    });

    it("should treat a malformed suspension date as missing and throw for incomplete", () => {
      // `new Date("not-a-date")` is Invalid Date, not null — without the parse guard it would
      // slip past the suspension-details check and render as broken copy.
      expect(
        () =>
          new SubscriptionPreviewResponse(
            responseJson({ Status: "incomplete", Suspension: "not-a-date", GracePeriod: 1 }),
          ),
      ).toThrow("Failed to parse missing suspension details for subscription status: incomplete");
    });

    it("should treat a malformed suspension date as absent for past_due", () => {
      const response = new SubscriptionPreviewResponse(
        responseJson({ Status: "past_due", Suspension: "not-a-date", GracePeriod: 3 }),
      );

      expect(response.suspension).toBeUndefined();
    });

    it("should treat a malformed canceled date as missing and throw", () => {
      expect(
        () =>
          new SubscriptionPreviewResponse(
            responseJson({ Status: "canceled", Canceled: "not-a-date" }),
          ),
      ).toThrow("Failed to parse missing canceled date for canceled subscription");
    });

    it.each(["trialing", "active"])(
      "should throw when a %s response omits the next payment attempt",
      (status) => {
        expect(
          () =>
            new SubscriptionPreviewResponse(
              responseJson({
                Status: status,
                InvoicePreview: { ...invoicePreviewJson, NextPaymentAttempt: null },
              }),
            ),
        ).toThrow(
          `Failed to parse missing next payment attempt for subscription status: ${status}`,
        );
      },
    );

    it("should treat a malformed next payment attempt as missing and throw for active", () => {
      // InvoicePreviewResponse degrades a malformed date to absent, so the billable-arm guard
      // catches it here rather than letting an Invalid Date reach the domain.
      expect(
        () =>
          new SubscriptionPreviewResponse(
            responseJson({
              Status: "active",
              InvoicePreview: { ...invoicePreviewJson, NextPaymentAttempt: "not-a-date" },
            }),
          ),
      ).toThrow("Failed to parse missing next payment attempt for subscription status: active");
    });

    it("should parse a non-billable response without a next payment attempt rather than throwing", () => {
      const response = new SubscriptionPreviewResponse(
        responseJson({
          Status: "past_due",
          InvoicePreview: { ...invoicePreviewJson, NextPaymentAttempt: null },
        }),
      );

      expect(response.invoicePreview.nextPaymentAttempt).toBeUndefined();
    });
  });

  describe("toDomain across all seven statuses", () => {
    const suspensionJson = {
      Suspension: "2026-03-01T00:00:00.000Z",
      GracePeriod: 14,
    };

    it.each(["incomplete", "incomplete_expired", "past_due", "unpaid"])(
      "should build the suspension arm for %s",
      (status) => {
        const response = new SubscriptionPreviewResponse(
          responseJson({ Status: status, ...suspensionJson }),
        );

        const domain = response.toDomain(adaptedCart);

        expect(domain).toEqual({
          cart: adaptedCart,
          storage: response.storage,
          status,
          suspension: new Date("2026-03-01T00:00:00.000Z"),
          gracePeriod: 14,
        });
      },
    );

    it("should build the suspension arm without details for a past_due response omitting them", () => {
      const response = new SubscriptionPreviewResponse(responseJson({ Status: "past_due" }));

      const domain = response.toDomain(adaptedCart);

      expect(domain).toMatchObject({
        status: "past_due",
        suspension: undefined,
        gracePeriod: undefined,
      });
    });

    it.each(["trialing", "active"])("should build the billable arm for %s", (status) => {
      const response = new SubscriptionPreviewResponse(
        responseJson({ Status: status, CancelAt: "2026-12-01T00:00:00.000Z" }),
      );

      const domain = response.toDomain(adaptedCart);

      expect(domain).toEqual({
        cart: adaptedCart,
        storage: response.storage,
        status,
        nextCharge: new Date("2026-06-01T00:00:00.000Z"),
        cancelAt: new Date("2026-12-01T00:00:00.000Z"),
      });
    });

    it("should build the billable arm without cancelAt when absent", () => {
      const response = new SubscriptionPreviewResponse(responseJson({ Status: "active" }));

      const domain = response.toDomain(adaptedCart);

      expect(domain).toMatchObject({
        status: "active",
        nextCharge: new Date("2026-06-01T00:00:00.000Z"),
        cancelAt: undefined,
      });
    });

    it("should build the canceled arm", () => {
      const response = new SubscriptionPreviewResponse(
        responseJson({ Status: "canceled", Canceled: "2026-05-01T00:00:00.000Z" }),
      );

      const domain = response.toDomain(adaptedCart);

      expect(domain).toEqual({
        cart: adaptedCart,
        storage: response.storage,
        status: "canceled",
        canceled: new Date("2026-05-01T00:00:00.000Z"),
      });
    });
  });

  describe("toDomain cart handling", () => {
    it("should use the supplied adapted cart, not the raw parsed preview", () => {
      const response = new SubscriptionPreviewResponse(responseJson());

      const domain = response.toDomain(adaptedCart);

      expect(domain.cart).toBe(adaptedCart);
      expect(domain.cart).not.toBe(response.invoicePreview);
    });

    it("should carry undefined storage through to the domain", () => {
      const response = new SubscriptionPreviewResponse(responseJson({ Storage: null }));

      const domain = response.toDomain(adaptedCart);

      expect(domain.storage).toBeUndefined();
    });
  });
});
