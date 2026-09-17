import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { Cart, CartItem } from "../../types/cart";
import {
  InvoicePreview,
  InvoicePreviewItem,
  PurchasableProration,
  PurchasableReference,
} from "../../types/invoice-preview";

import { InvoicePreviewFlowContext } from "./invoice-preview-flow-context";
import {
  getCartItemTranslationKey,
  getCreditTranslationKey,
  getProratedSeatTranslationKey,
  getProrationChargeTranslationKey,
} from "./translation";

export type AdaptInvoicePreviewOptions = {
  planName?: string;
};

/**
 * Where a proration charge appears in the cart.
 *
 * - SeatLine (upgrade, plan-change): the server bakes each proration charge into its seat line —
 *   the seat line is the charge. No separate charge row renders, and the seat line's quantity x
 *   cost breakdown hides because its cost is a lump, not a per-unit price. When the invoice is all
 *   prorations (the Premium upgrade's `always_invoice` preview), there is no seat line on the wire,
 *   so the summed charge becomes the seat line.
 * - ProrationLine (subscription page): the seat line is a real per-unit renewal price, or absent
 *   entirely on an all-proration transition invoice — where no seat quantity exists, so a seat
 *   line can't be built. Charged prorations render as their own lines either way.
 */
const ProrationChargePlacements = {
  SeatLine: "seat-line",
  ProrationLine: "proration-line",
} as const;
type ProrationChargePlacement =
  (typeof ProrationChargePlacements)[keyof typeof ProrationChargePlacements];

const getProrationChargePlacement = (
  flowContext: InvoicePreviewFlowContext,
): ProrationChargePlacement => {
  switch (flowContext) {
    case InvoicePreviewFlowContext.OrganizationSubscriptionPage:
      return ProrationChargePlacements.ProrationLine;
    default:
      return ProrationChargePlacements.SeatLine;
  }
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
    translationKey: getCartItemTranslationKey(
      item.reference,
      planTier,
      flowContext,
      logService,
      item.quantity,
    ),
    quantity: item.quantity,
    cost: item.cost,
    // Discounts pass through untouched: the server's `amount` is authoritative and the renderer
    // does not cascade per-line discounts.
    ...(item.discounts ? { discounts: item.discounts } : {}),
    ...(hideBreakdown ? { hideBreakdown: true } : {}),
  });

  /**
   * Constructs a proration charge line for the cart.
   */
  const chargeLine = (
    proration: PurchasableProration,
    seatReference: PurchasableReference,
  ): CartItem => ({
    translationKey: getProrationChargeTranslationKey(proration.reference, seatReference),
    quantity: 1,
    cost: proration.charge,
    hideBreakdown: true,
  });

  /**
   * Stands in for a missing seat line on SeatLine placements: the group's summed proration charge
   * at quantity 1, with the breakdown hidden because the cost is a lump. Returns `undefined` when
   * nothing was charged, so a credit-only group renders no seat row.
   */
  const derivedSeatLine = (
    prorations: PurchasableProration[] | undefined,
    seatReference: PurchasableReference,
  ): CartItem | undefined => {
    const cost = sumInCents((prorations ?? []).map((proration) => proration.charge));
    if (cost <= 0) {
      return undefined;
    }

    return {
      translationKey: getCartItemTranslationKey(
        seatReference,
        planTier,
        flowContext,
        logService,
        1,
      ),
      quantity: 1,
      cost,
      hideBreakdown: true,
    };
  };

  /**
   * Builds one product group's rows: its seat line, if the invoice carries one (or can stand in
   * for it), plus the group's charged prorations, placed per the flow's charge placement.
   */
  const buildGroup = (
    item: InvoicePreviewItem | undefined,
    prorations: PurchasableProration[] | undefined,
    seatReference: PurchasableReference,
  ): { seats?: CartItem; prorationCharges?: CartItem[] } => {
    const placement = getProrationChargePlacement(flowContext);

    // On SeatLine placements the seat line's cost is the proration charge itself — a lump, not a
    // per-unit price — so its quantity x cost breakdown would read false.
    const shouldHideBreakdown =
      placement === ProrationChargePlacements.SeatLine && hasProrations(prorations);

    const seats = item
      ? toCartItem(item, shouldHideBreakdown)
      : placement === ProrationChargePlacements.SeatLine
        ? derivedSeatLine(prorations, seatReference)
        : undefined;

    let prorationCharges: CartItem[] | undefined;
    if (placement === ProrationChargePlacements.ProrationLine && prorations != null) {
      prorationCharges = prorations
        .filter((proration) => proration.charge > 0)
        .map((proration) => chargeLine(proration, seatReference));
    }

    return {
      seats,
      prorationCharges: prorationCharges?.length ? prorationCharges : undefined,
    };
  };

  const pm = buildGroup(passwordManager.seats, passwordManager.prorations, "pm-seat");
  const sm = secretsManager
    ? buildGroup(secretsManager.seats, secretsManager.prorations, "sm-seat")
    : {};

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

  // A mid-cycle change can return an "all-proration" invoice: only one-time proration adjustments,
  // with no recurring seat, storage, or service-account line items.
  const allProrationInvoice =
    pm.seats == null &&
    passwordManager.additionalStorage == null &&
    sm.seats == null &&
    secretsManager?.additionalServiceAccounts == null;

  const cart: Cart = {
    passwordManager: {
      ...(pm.seats ? { seats: labelProratedMonths(pm.seats) } : {}),
      ...(passwordManager.additionalStorage
        ? { additionalStorage: toCartItem(passwordManager.additionalStorage) }
        : {}),
      ...(pm.prorationCharges ? { prorationCharges: pm.prorationCharges } : {}),
    },
    ...(secretsManager &&
    (sm.seats || secretsManager.additionalServiceAccounts || sm.prorationCharges)
      ? {
          secretsManager: {
            ...(sm.seats ? { seats: sm.seats } : {}),
            ...(secretsManager.additionalServiceAccounts
              ? {
                  additionalServiceAccounts: toCartItem(secretsManager.additionalServiceAccounts),
                }
              : {}),
            ...(sm.prorationCharges ? { prorationCharges: sm.prorationCharges } : {}),
          },
        }
      : {}),
    cadence: preview.cadence,
    ...(allProrationInvoice ? { hidePricingTerm: true } : {}),
    ...(preview.discounts ? { discounts: preview.discounts } : {}),
    estimatedTax: preview.estimatedTax,
    total: preview.amountDue,
  };

  const credit = buildCreditRow(preview, flowContext);
  if (credit) {
    cart.credit = credit;
  }

  const accountCredit = buildAccountCreditRow(preview);
  if (accountCredit) {
    cart.accountCredit = accountCredit;
  }

  // Deliberately NOT mapped as their own fields:
  // - `total`: rendered indirectly, as `amountDue` plus the account credit row.
  // - `startingBalance`: rendered indirectly, as the account credit row.
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
 * emitted only when the total is positive AND the flow context actually renders credit.
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

/**
 * Emits the account balance Stripe applied to the invoice as its own row, so the line items still
 * sum to the rendered `amountDue`.
 *
 * The row's value is `total - amountDue` rather than `startingBalance`: a balance larger than the
 * invoice is only applied up to the invoice total, and the difference between the two
 * server-supplied figures is exactly what Stripe consumed. `startingBalance` gates the row so the
 * "Account credit" label is only shown when a credit balance is what closed the gap.
 */
const buildAccountCreditRow = (preview: InvoicePreview): Cart["accountCredit"] => {
  if (preview.startingBalance === undefined || preview.startingBalance >= 0) {
    return undefined;
  }

  const value = sumInCents([preview.total, -preview.amountDue]);
  if (value <= 0) {
    return undefined;
  }

  return { translationKey: "accountCredit", value };
};
