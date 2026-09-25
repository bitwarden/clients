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
 * Describes the layout policy for a cart, derived from the flow context.
 * - `prorationChargesAsSeparateLines`: whether charged prorations render as their own lines.
 *   When `false`, the server bakes each proration charge into its seat line — the seat line is the
 *   charge
 * - `hidePricingTerm`: whether to suppress the recurring pricing term because the invoice is a
 *   one-time invoice rather than a renewal.
 */
type CartLayout = {
  prorationChargesAsSeparateLines: boolean;
  hidePricingTerm: boolean;
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
  const layout = resolveCartLayout(preview, flowContext);

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
   * Builds one product group's rows: its seat line, if the invoice carries one, plus the group's
   * charged prorations, placed per the resolved layout.
   */
  const buildGroup = (
    item: InvoicePreviewItem | undefined,
    prorations: PurchasableProration[] | undefined,
    seatReference: PurchasableReference,
  ): { seats?: CartItem; prorationCharges?: CartItem[] } => {
    const hideBreakdown = !layout.prorationChargesAsSeparateLines && hasProrations(prorations);
    const seats = item ? toCartItem(item, hideBreakdown) : undefined;

    let prorationCharges: CartItem[] | undefined;
    if (layout.prorationChargesAsSeparateLines && prorations != null) {
      const charged = prorations.filter((proration) => proration.charge > 0);
      // Seat charge first, then the group's other purchasable (e.g. storage under it). A proration
      // is only identifiable as non-seat by its reference — the same reference that labels it.
      const isSeatCharge = (proration: PurchasableProration) =>
        (proration.reference ?? seatReference) === seatReference;
      prorationCharges = [
        ...charged.filter(isSeatCharge),
        ...charged.filter((p) => !isSeatCharge(p)),
      ].map((proration) => chargeLine(proration, seatReference));
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
    ...(layout.hidePricingTerm ? { hidePricingTerm: layout.hidePricingTerm } : {}),
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
 * Resolves the layout policy for a cart based on the invoice preview and flow context.
 * @param preview The current invoice preview.
 * @param flowContext The current flow context of the invoice preview.
 * @returns The resolved {@link CartLayout}.
 */
const resolveCartLayout = (
  preview: InvoicePreview,
  flowContext: InvoicePreviewFlowContext,
): CartLayout => ({
  prorationChargesAsSeparateLines:
    flowContext === InvoicePreviewFlowContext.OrganizationSubscriptionPage ||
    flowContext === InvoicePreviewFlowContext.OrganizationPlanChange,
  hidePricingTerm: shouldHidePricingTerm(preview, flowContext),
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
 * Determines whether the pricing term for a line should be hidden based on the flow context and the presence of prorations.
 * @param preview The current invoice preview.
 * @param flowContext The current flow context of the invoice preview.
 * @returns `true` if the pricing term should be hidden, `false` otherwise.
 */
const shouldHidePricingTerm = (
  preview: InvoicePreview,
  flowContext: InvoicePreviewFlowContext,
): boolean => {
  const { passwordManager, secretsManager } = preview;

  // All-proration invoice: only one-time proration adjustments, no recurring line at all.
  if (
    passwordManager.seats == null &&
    passwordManager.additionalStorage == null &&
    secretsManager?.seats == null &&
    secretsManager?.additionalServiceAccounts == null
  ) {
    return true;
  }

  // Mid-cycle plan change: a one-time proration invoice
  if (
    flowContext === InvoicePreviewFlowContext.OrganizationPlanChange &&
    (hasProrations(passwordManager.prorations) || hasProrations(secretsManager?.prorations))
  ) {
    return true;
  }

  return false;
};

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
