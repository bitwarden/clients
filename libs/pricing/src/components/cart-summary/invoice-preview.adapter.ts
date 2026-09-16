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
  getProrationChargeTranslationKey,
} from "./translation";

/**
 * Where a proration charge appears in the cart.
 *
 * - SeatLine (upgrade, plan-change): the server bakes each proration charge into its seat line —
 *   the seat line is the charge. No separate charge row renders, and the seat line's quantity x
 *   cost breakdown hides because its cost is a lump, not a per-unit price.
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
   * Builds one product group's rows: its seat line, if the invoice carries one, plus the group's
   * charged prorations, placed per the flow's charge placement.
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

    const seats = item ? toCartItem(item, shouldHideBreakdown) : undefined;

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

  // A mid-cycle change can return an "all-proration" invoice: only one-time proration adjustments,
  // with no recurring seat, storage, or service-account line items.
  const allProrationInvoice =
    pm.seats == null &&
    passwordManager.additionalStorage == null &&
    sm.seats == null &&
    secretsManager?.additionalServiceAccounts == null;

  const cart: Cart = {
    passwordManager: {
      ...(pm.seats ? { seats: pm.seats } : {}),
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
    total: preview.total,
  };

  const credit = buildCreditRow(preview, flowContext);
  if (credit) {
    cart.credit = credit;
  }

  // Deliberately NOT mapped:
  // - `startingBalance`: the cart summary does not render account balance.
  // - `amountDue` and `nextPaymentAttempt`: no corresponding `Cart` field.
  return cart;
};

const hasProrations = (prorations: PurchasableProration[] | undefined): boolean =>
  !!prorations && prorations.length > 0;

/**
 * Collapses every proration across both product groups into at most one credit row.
 *
 * Sums in integer cents and converts once at the end so a run of fractional credits cannot
 * accumulate floating-point drift. The row is emitted only when the total is positive AND the
 * flow context actually renders credit.
 */
const buildCreditRow = (
  preview: InvoicePreview,
  flowContext: InvoicePreviewFlowContext,
): Cart["credit"] => {
  const translationKey = getCreditTranslationKey(flowContext);
  if (!translationKey) {
    return undefined;
  }

  const totalCents = [
    ...(preview.passwordManager.prorations ?? []),
    ...(preview.secretsManager?.prorations ?? []),
  ].reduce((sum, proration) => sum + Math.round(proration.credit * 100), 0);

  if (totalCents <= 0) {
    return undefined;
  }

  return { translationKey, value: totalCents / 100 };
};
