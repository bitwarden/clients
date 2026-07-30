/**
 * Identifies which purchase or subscription surface a cart preview is being rendered for.
 *
 * The same purchasable reference maps to different copy depending on the surface — a Password
 * Manager seat reads as "Premium membership" during personal checkout but as "Password Manager
 * plan price" during organization checkout. Each facade method bakes its own flow context so
 * components never have to pass one.
 */
export const InvoicePreviewFlowContext = Object.freeze({
  PremiumSubscriptionPage: "premium-subscription-page",
  PersonalCheckout: "personal-checkout",
  PremiumOrgUpgrade: "premium-org-upgrade",
  OrganizationCheckout: "organization-checkout",
  OrganizationPlanChange: "organization-plan-change",
  OrganizationSubscriptionPage: "organization-subscription-page",
} as const);

export type InvoicePreviewFlowContext =
  (typeof InvoicePreviewFlowContext)[keyof typeof InvoicePreviewFlowContext];
