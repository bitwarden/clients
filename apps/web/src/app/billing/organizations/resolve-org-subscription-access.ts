import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * Visibility flags for organization subscription UI sections.
 */
export interface OrgSubscriptionAccess {
  /** Whether to show the subscription information section. */
  showSubscription: boolean;

  /** Whether to show the subscription management actions (change plan, adjust, cancel). */
  showManagementActions: boolean;

  /** Whether to show the self-hosted license section. */
  showSelfHost: boolean;

  /** Whether the organization is managed by a consolidated billing MSP. */
  showConsolidatedBillingMsp: boolean;

  /** Whether the organization is on the free plan (no paid Stripe subscription to preview). */
  isFreeOrg: boolean;
}

/**
 * Pure security boundary, unit-tested in isolation.
 * Resolves organization subscription access visibility flags.
 *
 * @param org - The organization to resolve access for
 * @returns Visibility flags for subscription UI sections
 */
export function resolveOrgSubscriptionAccess(org: Organization): OrgSubscriptionAccess {
  const managedByConsolidatedBillingMsp = org.hasProvider && org.hasBillableProvider;
  return {
    showSubscription: org.canViewSubscription && !managedByConsolidatedBillingMsp,
    showManagementActions: org.canEditSubscription && !managedByConsolidatedBillingMsp,
    showSelfHost: org.selfHost,
    showConsolidatedBillingMsp: managedByConsolidatedBillingMsp,
    isFreeOrg: org.isFreeOrg,
  };
}
