import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

/**
 * Visibility flags for organization subscription UI sections.
 */
export interface OrgSubscriptionAccess {
  /** Whether to show the subscription information section. Hidden for provider-managed orgs. */
  showSubscription: boolean;

  /** Whether to fetch the organization subscription record (status). Resold organization owners
   *  get the status without the subscription details. */
  showSubscriptionStatus: boolean;

  /** Whether to show the subscription management actions (change plan, adjust, cancel). */
  canEditSubscription: boolean;

  /** Whether to show the self-hosted license section. */
  showSelfHost: boolean;

  /** Whether the organization is on the free plan (no paid Stripe subscription to preview). */
  isFreeOrg: boolean;

  /** Whether the organization can use billing sync (Enterprise self-hosted license feature). */
  canUseBillingSync: boolean;

  /** Whether to show the provider-managed billing section (billable/consolidated-billing MSP). */
  showProviderManagedBilling: boolean;
}

/**
 * Pure security boundary, unit-tested in isolation.
 * Resolves organization subscription access visibility flags.
 *
 * @param org - The organization to resolve access for
 * @returns Visibility flags for subscription UI sections
 */
export function resolveOrgSubscriptionAccess(org: Organization): OrgSubscriptionAccess {
  const isResoldOrganizationOwner = org.hasReseller && org.isOwner;

  // Only the owner of an org that owns its own billing relationship sees the subscription. For a
  // provider-less org, canViewSubscription reduces to isOwner, so this matches legacy's gate.
  const showSubscription = org.isOwner && !org.hasProvider;

  return {
    showSubscription,
    showSubscriptionStatus: showSubscription || isResoldOrganizationOwner,
    canEditSubscription: showSubscription && org.canEditSubscription,
    showSelfHost: org.selfHost,
    isFreeOrg: org.isFreeOrg,
    canUseBillingSync: org.productTierType === ProductTierType.Enterprise,
    showProviderManagedBilling: org.hasBillableProvider,
  };
}
