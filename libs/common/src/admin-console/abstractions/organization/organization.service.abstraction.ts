import { combineLatest, map, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { UserId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { OrganizationData } from "../../models/data/organization.data";
import { Organization } from "../../models/domain/organization";
import { PolicyService } from "../policy/policy.service.abstraction";

export function canAccessVaultTab(org: Organization): boolean {
  return org.canViewAllCollections;
}

export function canAccessSettingsTab(org: Organization): boolean {
  return (
    org.isOwner ||
    org.canManagePolicies ||
    org.canManageSso ||
    org.canManageScim ||
    org.canAccessImport ||
    org.canAccessExport ||
    org.canManageDeviceApprovals
  );
}

export function canAccessMembersTab(org: Organization): boolean {
  return org.canManageUsers || org.canManageUsersPassword;
}

export function canAccessGroupsTab(org: Organization): boolean {
  return org.canManageGroups;
}

export function canAccessReportingTab(org: Organization): boolean {
  return org.canAccessReports || org.canAccessEventLogs;
}

export function canAccessBillingTab(org: Organization): boolean {
  return org.isOwner;
}

export function canAccessOrgAdmin(org: Organization): boolean {
  // Admin console can only be accessed by Owners for disabled organizations
  if (!org.enabled && !org.isOwner) {
    return false;
  }
  return (
    canAccessMembersTab(org) ||
    canAccessGroupsTab(org) ||
    canAccessReportingTab(org) ||
    canAccessBillingTab(org) ||
    canAccessSettingsTab(org) ||
    canAccessVaultTab(org)
  );
}

export function canAccessEmergencyAccess(
  userId: UserId,
  configService: ConfigService,
  policyService: PolicyService,
) {
  return combineLatest([
    configService.getFeatureFlag$(FeatureFlag.AutoConfirm),
    policyService.policiesByType$(PolicyType.AutoConfirm, userId),
  ]).pipe(map(([enabled, policies]) => !enabled || !policies.some((p) => p.enabled)));
}

/**
 * @deprecated Please use the general `getById` custom rxjs operator instead.
 */
export function getOrganizationById(id: string) {
  return map<Organization[], Organization | undefined>((orgs) => orgs.find((o) => o.id === id));
}

/**
 * Publishes an observable stream of organizations. This service is meant to
 * be used widely across Bitwarden as the primary way of fetching organizations.
 * Risky operations like updates are isolated to the
 * internal extension `InternalOrganizationServiceAbstraction`.
 */
export abstract class OrganizationService {
  /**
   * Publishes state for all organizations under the specified user.
   * @returns An observable list of organizations
   */
  abstract organizations$(userId: UserId): Observable<Organization[]>;

  // @todo Clean these up. Continuing to expand them is not recommended.
  // @see https://bitwarden.atlassian.net/browse/AC-2252
  abstract memberOrganizations$(userId: UserId): Observable<Organization[]>;
  /**
   * Emits true if the user can create or manage a Free Bitwarden Families sponsorship.
   */
  abstract canManageSponsorships$(userId: UserId): Observable<boolean>;
  /**
   * Emits true if any of the user's organizations have a Free Bitwarden Families sponsorship available.
   */
  abstract familySponsorshipAvailable$(userId: UserId): Observable<boolean>;
  abstract hasOrganizations(userId: UserId): Observable<boolean>;
}

/**
 * Big scary buttons that **update** organization state. These should only be
 * called from within admin-console scoped code. Extends the base
 * `OrganizationService` for easy access to `get` calls.
 * @internal
 */
export abstract class InternalOrganizationServiceAbstraction extends OrganizationService {
  /**
   * Replaces state for the provided organization, or creates it if not found.
   * @param organization The organization state being saved.
   * @param userId The userId to replace state for.
   */
  abstract upsert(OrganizationData: OrganizationData, userId: UserId): Promise<void>;

  /**
   * Replaces state for the entire registered organization list for the specified user.
   * You probably don't want this unless you're calling from a full sync
   * operation or a logout. See `upsert` for creating & updating a single
   * organization in the state.
   * @param organizations A complete list of all organization state for the provided
   * user.
   * @param userId The userId to replace state for.
   */
  abstract replace(
    organizations: { [id: string]: OrganizationData },
    userId: UserId,
  ): Promise<void>;
}
