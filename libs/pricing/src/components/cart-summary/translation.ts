import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PlanTier, PurchasableReference } from "../../types/invoice-preview";

import { InvoicePreviewFlowContext } from "./invoice-preview-flow-context";

/**
 * Centralizes the `(reference, planTier, flowContext) -> i18n key` fan-out that each cart surface
 * used to hardcode. Keys returned here live in the consuming app's `messages.json`.
 *
 * The mapping is deliberately PARTIAL. Some combinations are legal to the type system but cannot
 * occur in practice — an organization checkout never sells the "premium" tier, for example. Rather
 * than invent keys to fill the matrix, unmapped combinations log and return an empty string: the
 * label renders blank but the cart still renders. This mirrors the server contract's
 * skip-and-log philosophy.
 */

const membershipKeysByTier: Record<PlanTier, string> = {
  premium: "premiumMembership",
  families: "familiesMembership",
  teams: "teamsMembership",
  enterprise: "enterpriseMembership",
};

/**
 * Resolves the translation key for a cart line item.
 *
 * @returns the i18n key, or an empty string when the combination is not mapped.
 */
export const getCartItemTranslationKey = (
  reference: PurchasableReference,
  planTier: PlanTier,
  flowContext: InvoicePreviewFlowContext,
  logService: LogService,
  quantity?: number,
): string => {
  switch (reference) {
    case "pm-seat":
      return getSeatUnitTranslationKey(
        getPasswordManagerSeatTranslationKey(planTier, flowContext, logService),
        quantity ?? 0,
      );
    case "pm-storage":
      return "additionalStorageGbLower";
    case "sm-seat":
      return getSeatUnitTranslationKey(
        getSecretsManagerSeatTranslationKey(flowContext),
        quantity ?? 0,
      );
    case "sm-service-account":
      return "additionalServiceAccountsLower";
    default: {
      // `reference` is a closed union, so this arm is unreachable through the type system. It
      // still guards against a server value outside the union reaching us at runtime.
      const _exhaustive: never = reference;
      logService.error(`Unhandled purchasable reference: ${String(_exhaustive)}`);
      return "";
    }
  }
};

/**
 * Password Manager seat copy varies by both surface and tier, so it gets its own resolver.
 */
const getPasswordManagerSeatTranslationKey = (
  planTier: PlanTier,
  flowContext: InvoicePreviewFlowContext,
  logService: LogService,
): string => {
  switch (flowContext) {
    case InvoicePreviewFlowContext.PremiumSubscriptionPage:
      if (planTier === "premium") {
        return membershipKeysByTier.premium;
      }
      break;
    case InvoicePreviewFlowContext.PersonalCheckout:
      if (planTier === "premium" || planTier === "families") {
        return membershipKeysByTier[planTier];
      }
      break;
    case InvoicePreviewFlowContext.PremiumOrgUpgrade:
      if (planTier === "families" || planTier === "teams" || planTier === "enterprise") {
        return membershipKeysByTier[planTier];
      }
      break;
    // Org purchase surfaces (checkout and plan-change) show per-seat plan-price copy; premium is
    // not an org tier, so the tier guard leaves it unmapped. The subscription page diverges below.
    case InvoicePreviewFlowContext.OrganizationPlanChange:
    case InvoicePreviewFlowContext.OrganizationCheckout:
      if (planTier === "families" || planTier === "teams" || planTier === "enterprise") {
        return "passwordManagerPlanPrice";
      }
      break;
    case InvoicePreviewFlowContext.OrganizationSubscriptionPage:
      // Teams/Enterprise bill per seat, so "members"; Families is one flat plan (plan price).
      if (planTier === "teams" || planTier === "enterprise") {
        return "membersLower";
      }
      if (planTier === "families") {
        return "passwordManagerPlanPrice";
      }
      break;
  }

  logService.error(
    `Unmapped Password Manager seat translation for plan tier "${planTier}" in flow context "${flowContext}"`,
  );
  return "";
};

/**
 * Resolves the translation key for a Secrets Manager seat based on the flow context.
 */
const getSecretsManagerSeatTranslationKey = (flowContext: InvoicePreviewFlowContext): string => {
  switch (flowContext) {
    case InvoicePreviewFlowContext.OrganizationSubscriptionPage:
      return "membersLower";
    default:
      return "secretsManagerPlanPrice";
  }
};

/**
 * Resolves the translation key for the collapsed proration credit row.
 *
 * Surfaces that do not render a credit row return `undefined`, and the adapter emits no credit
 * row at all.
 */
export const getCreditTranslationKey = (
  flowContext: InvoicePreviewFlowContext,
): string | undefined => {
  switch (flowContext) {
    case InvoicePreviewFlowContext.PremiumOrgUpgrade:
      return "premiumSubscriptionCredit";
    case InvoicePreviewFlowContext.OrganizationPlanChange:
    case InvoicePreviewFlowContext.OrganizationSubscriptionPage:
      return "appliedSubscriptionCredits";
    default:
      return undefined;
  }
};

/**
 * Resolves the seat-count unit for a line item: "members" reads wrong for a single seat, so a
 * lone seat renders the singular. Non-seat keys pass through unchanged.
 */
export const getSeatUnitTranslationKey = (key: string, quantity: number): string =>
  key === "membersLower" && quantity === 1 ? "memberLower" : key;

/**
 * Resolves the translation key for a proration charge line by the purchasable it offsets,
 * falling back to the group's seat reference when the server omits the reference.
 */
export const getProrationChargeTranslationKey = (
  reference: PurchasableReference | undefined,
  seatReference: PurchasableReference,
): string => {
  // `reference` passes through the response unvalidated, so an unknown server value is possible;
  // fall back to the group's charge key rather than rendering a blank label.
  switch (reference ?? seatReference) {
    case "pm-seat":
      return "passwordManagerProratedCharge";
    case "pm-storage":
      return "storageProratedCharge";
    case "sm-seat":
      return "secretsManagerProratedCharge";
    case "sm-service-account":
      return "serviceAccountsProratedCharge";
    default:
      return seatReference === "pm-seat"
        ? "passwordManagerProratedCharge"
        : "secretsManagerProratedCharge";
  }
};
/**
 * Resolves the seat label that carries the plan name and prorated month count. Only the
 * Premium-to-organization upgrade renders it; every other surface returns `undefined` and keeps
 * the plain membership label.
 */
export const getProratedSeatTranslationKey = (
  flowContext: InvoicePreviewFlowContext,
): string | undefined =>
  flowContext === InvoicePreviewFlowContext.PremiumOrgUpgrade
    ? "planProratedMembershipInMonths"
    : undefined;
