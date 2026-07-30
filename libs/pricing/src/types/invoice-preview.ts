import { Discount } from "./discount";

/**
 * TypeScript mirrors of the server's cart preview record family, which projects a Stripe invoice
 * preview into a structure the cart summary can render.
 *
 * These types are the wire contract. They are converted into the render-ready `Cart` view model by
 * `adaptInvoicePreviewToCart`; components never consume them directly.
 */

/**
 * Mirrors the server's plan tier enum.
 *
 * There is no "free" tier because a free plan has no cart, and no "TeamsStarter" because the
 * server collapses it into "teams".
 */
export type PlanTier = "families" | "teams" | "enterprise" | "premium";

/**
 * The closed set of purchasable references, mirroring the purchasable-reference contract.
 *
 * Typing `reference` as this union rather than a raw string makes a stray value a compile error
 * and lets `getCartItemTranslationKey` switch exhaustively without a verbatim fallback.
 */
export type PurchasableReference = "pm-seat" | "pm-storage" | "sm-seat" | "sm-service-account";

export type InvoicePreviewItem = {
  reference: PurchasableReference;
  quantity: number;
  cost: number;
  discounts?: Discount[];
};

/**
 * A single proration entry. Retained in full for parity with the server contract; the client
 * currently renders only the summed `credit` as one collapsed credit row, so `months`, `charge`,
 * `tax` and `total` are unused client-side.
 */
export type PurchasableProration = {
  credit: number;
  charge: number;
  tax: number;
  total: number;
  months: number;
};

export type InvoicePreview = {
  passwordManager: {
    seats: InvoicePreviewItem;
    additionalStorage?: InvoicePreviewItem;
    prorations?: PurchasableProration[];
  };
  secretsManager?: {
    seats: InvoicePreviewItem;
    additionalServiceAccounts?: InvoicePreviewItem;
    prorations?: PurchasableProration[];
  };
  cadence: "annually" | "monthly";
  planTier: PlanTier;
  discounts?: Discount[];
  startingBalance?: number;
  estimatedTax: number;
  total: number;
  amountDue: number;
  /**
   * The billing-period boundary from the server's subscription preview query — NOT the invoice's
   * scheduled charge date.
   */
  nextPaymentAttempt?: Date;
};
