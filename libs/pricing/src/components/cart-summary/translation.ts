import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PlanTier, PurchasableReference } from "../../types/invoice-preview";

import { InvoicePreviewFlowContext } from "./invoice-preview-flow-context";

/**
 * Centralizes the `(reference, planTier, flowContext) -> i18n key` fan-out that each cart surface
 * used to hardcode. Every key returned here already exists in the web client's `messages.json`,
 * with the sole exception of `appliedSubscriptionCredits`, added alongside this helper.
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
): string => {
  switch (reference) {
    case "pm-seat":
      return getPasswordManagerSeatTranslationKey(planTier, flowContext, logService);
    case "pm-storage":
      return "additionalStorageGb";
    case "sm-seat":
      return "secretsManagerPlanPrice";
    case "sm-service-account":
      return "additionalServiceAccounts";
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
 * Password Manager seats are the only reference whose copy varies by surface and tier.
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
    // Plan-change previews always describe an existing organization moving between org tiers,
    // so they render the same per-seat plan-price copy as the other org-scoped surfaces. A
    // premium tier can't be plan-changed into, hence the tier guard below leaves it unmapped.
    case InvoicePreviewFlowContext.OrganizationCheckout:
    case InvoicePreviewFlowContext.OrganizationSubscriptionPage:
    case InvoicePreviewFlowContext.OrganizationPlanChange:
      if (planTier === "families" || planTier === "teams" || planTier === "enterprise") {
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
 * Resolves the translation key for the collapsed proration credit row.
 *
 * Only two surfaces render a credit row. Every other flow context returns `undefined`, and the
 * adapter emits no credit row at all.
 */
export const getCreditTranslationKey = (
  flowContext: InvoicePreviewFlowContext,
): string | undefined => {
  switch (flowContext) {
    case InvoicePreviewFlowContext.PremiumOrgUpgrade:
      return "premiumSubscriptionCredit";
    case InvoicePreviewFlowContext.OrganizationPlanChange:
      return "appliedSubscriptionCredits";
    default:
      return undefined;
  }
};
