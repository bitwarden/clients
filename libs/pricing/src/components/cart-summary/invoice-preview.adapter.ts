import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { Cart, CartItem } from "../../types/cart";
import {
  InvoicePreview,
  InvoicePreviewItem,
  PurchasableProration,
} from "../../types/invoice-preview";

import { InvoicePreviewFlowContext } from "./invoice-preview-flow-context";
import {
  getCartItemTranslationKey,
  getCreditTranslationKey,
  getProratedSeatTranslationKey,
} from "./translation";

export type AdaptInvoicePreviewOptions = {
  planName?: string;
};

/**
 * Converts the server's `InvoicePreview` wire model into the render-ready `Cart` view model consumed
 * by `<billing-cart-summary>`.
 *
 * Pure by design — no DI, no side effects beyond logging — so it is unit-testable in isolation and
 * has exactly one caller per facade method. Server-supplied amounts are authoritative throughout;
 * this adapter reshapes and relabels but never recomputes pricing.
 */
export const adaptInvoicePreviewToCart = (
  preview: InvoicePreview,
  flowContext: InvoicePreviewFlowContext,
  logService: LogService,
  options: AdaptInvoicePreviewOptions = {},
): Cart => {
  const { passwordManager, secretsManager, planTier } = preview;

  const toCartItem = (item: InvoicePreviewItem, hideBreakdown: boolean = false): CartItem => ({
    translationKey: getCartItemTranslationKey(item.reference, planTier, flowContext, logService),
    quantity: item.quantity,
    cost: item.cost,
    // Discounts pass through untouched: the server's `amount` is authoritative and the renderer
    // does not cascade per-line discounts.
    ...(item.discounts ? { discounts: item.discounts } : {}),
    ...(hideBreakdown ? { hideBreakdown: true } : {}),
  });

  // A prorated group's seat line is a prorated charge, not a per-unit price, so its quantity x cost
  // breakdown would be misleading. Applies to the seat line of that group only.
  const passwordManagerProrated = hasProrations(passwordManager.prorations);
  const secretsManagerProrated = hasProrations(secretsManager?.prorations);

  const passwordManagerSeats = (): CartItem => {
    if (passwordManager.seats) {
      return toCartItem(passwordManager.seats, passwordManagerProrated);
    }

    if (!passwordManagerProrated) {
      throw new Error("Invoice preview has neither a Password Manager seats line nor a proration.");
    }

    return {
      translationKey: getCartItemTranslationKey("pm-seat", planTier, flowContext, logService),
      quantity: 1,
      cost: sumInCents(passwordManager.prorations!.map((proration) => proration.charge)),
      hideBreakdown: true,
    };
  };

  const proratedMonths = passwordManager.prorations?.[0]?.months ?? 0;

  const labelProratedMonths = (seats: CartItem): CartItem => {
    const translationKey = getProratedSeatTranslationKey(flowContext);
    if (!translationKey || !options.planName || proratedMonths <= 0) {
      return seats;
    }

    return {
      ...seats,
      translationKey,
      translationParams: [options.planName, formatMonthLabel(proratedMonths)],
    };
  };

  const cart: Cart = {
    passwordManager: {
      seats: labelProratedMonths(passwordManagerSeats()),
      ...(passwordManager.additionalStorage
        ? { additionalStorage: toCartItem(passwordManager.additionalStorage) }
        : {}),
    },
    ...(secretsManager && (secretsManager.seats || secretsManager.additionalServiceAccounts)
      ? {
          secretsManager: {
            ...(secretsManager.seats
              ? { seats: toCartItem(secretsManager.seats, secretsManagerProrated) }
              : {}),
            ...(secretsManager.additionalServiceAccounts
              ? {
                  additionalServiceAccounts: toCartItem(secretsManager.additionalServiceAccounts),
                }
              : {}),
          },
        }
      : {}),
    cadence: preview.cadence,
    ...(preview.discounts ? { discounts: preview.discounts } : {}),
    estimatedTax: preview.estimatedTax,
    total: preview.amountDue,
  };

  const credit = buildCreditRow(preview, flowContext);
  if (credit) {
    cart.credit = credit;
  }

  // Deliberately NOT mapped:
  // - `total`: superseded by `amountDue` above.
  // - `startingBalance`: the cart summary does not render account balance.
  // - `nextPaymentAttempt`: no corresponding `Cart` field.
  return cart;
};

const hasProrations = (prorations: PurchasableProration[] | undefined): boolean =>
  !!prorations && prorations.length > 0;

const formatMonthLabel = (months: number): string => `${months} month${months > 1 ? "s" : ""}`;

/** Sums in integer cents and converts once so a run of fractional amounts cannot accumulate drift. */
const sumInCents = (amounts: number[]): number =>
  amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100;

/**
 * Collapses every proration across both product groups into at most one credit row. The row is
 * emitted only when the total is positive AND the flow context actually renders credit — only two
 * surfaces do.
 */
const buildCreditRow = (
  preview: InvoicePreview,
  flowContext: InvoicePreviewFlowContext,
): Cart["credit"] => {
  const translationKey = getCreditTranslationKey(flowContext);
  if (!translationKey) {
    return undefined;
  }

  const value = sumInCents(
    [
      ...(preview.passwordManager.prorations ?? []),
      ...(preview.secretsManager?.prorations ?? []),
    ].map((proration) => proration.credit),
  );

  if (value <= 0) {
    return undefined;
  }

  return { translationKey, value };
};
