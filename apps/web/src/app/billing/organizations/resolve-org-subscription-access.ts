import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

/**
 * Visibility flags for organization subscription UI sections.
 */
export interface OrgSubscriptionAccess {
  /** Whether to show the subscription information section. */
  showSubscription: boolean;

  /** Whether to show the self-hosted license section. */
  showSelfHost: boolean;

  /** Whether the organization is managed by a consolidated billing MSP. */
  showConsolidatedBillingMsp: boolean;
}

/**
 * Pure security boundary, unit-tested in isolation.
 * Resolves organization subscription access visibility flags.
 *
 * @param org - The organization to resolve access for
 * @returns Visibility flags for subscription UI sections
 */
export function resolveOrgSubscriptionAccess(org: Organization): OrgSubscriptionAccess {
  return {
    showSubscription: org.canViewSubscription,
    showSelfHost: org.canEditSubscription && org.selfHost,
    showConsolidatedBillingMsp: org.hasProvider,
  };
}
