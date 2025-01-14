// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { map, Observable } from "rxjs";

import { UserId } from "../../../types/guid";
import { OrganizationData } from "../../models/data/organization.data";
import { Organization } from "../../models/domain/organization";

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
    org.canAccessExport(false) || // Feature flag value doesn't matter here, providers will have access to this group anyway
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

export function getOrganizationById(id: string) {
  return map<Organization[], Organization | undefined>((orgs) => orgs.find((o) => o.id === id));
}

/**
 * Returns `true` if a user is a member of an organization (rather than only being a ProviderUser)
 * @deprecated Use organizationService.organizations$ with a filter instead
 */
export function isMember(org: Organization): boolean {
  return org.isMember;
}

/**
 * Publishes an observable stream of organizations. This service is meant to
 * be used widely across Bitwarden as the primary way of fetching organizations.
 * Risky operations like updates are isolated to the
 * internal extension `InternalOrganizationServiceAbstraction`.
 */
export abstract class OrganizationService {
  /**
   * Publishes state for all organizations under the active user.
   * @returns An observable list of organizations
   */
  organizations$: Observable<Organization[]>;

  // @todo Clean these up. Continuing to expand them is not recommended.
  // @see https://bitwarden.atlassian.net/browse/AC-2252
  memberOrganizations$: Observable<Organization[]>;
  /**
   * @deprecated This is currently only used in the CLI, and should not be
   * used in any new calls. Use get$ instead for the time being, and we'll be
   * removing this method soon. See Jira for details:
   * https://bitwarden.atlassian.net/browse/AC-2252.
   */
  getFromState: (id: string) => Promise<Organization>;
  /**
   * Emits true if the user can create or manage a Free Bitwarden Families sponsorship.
   */
  canManageSponsorships$: Observable<boolean>;
  /**
   * Emits true if any of the user's organizations have a Free Bitwarden Families sponsorship available.
   */
  familySponsorshipAvailable$: Observable<boolean>;
  hasOrganizations: () => Promise<boolean>;
  get$: (id: string) => Observable<Organization | undefined>;
  get: (id: string) => Promise<Organization>;
  /**
   * @deprecated This method is only used in key connector and will be removed soon as part of https://bitwarden.atlassian.net/browse/AC-2252.
   */
  getAll: (userId?: string) => Promise<Organization[]>;

  /**
   * Publishes state for all organizations for the given user id or the active user.
   */
  getAll$: (userId?: UserId) => Observable<Organization[]>;
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
   * @param userId The userId to replace state for. Defaults to the active
   * user.
   */
  upsert: (OrganizationData: OrganizationData) => Promise<void>;

  /**
   * Replaces state for the entire registered organization list for the active user.
   * You probably don't want this unless you're calling from a full sync
   * operation or a logout. See `upsert` for creating & updating a single
   * organization in the state.
   * @param organizations A complete list of all organization state for the active
   * user.
   * @param userId The userId to replace state for. Defaults to the active
   * user.
   */
  replace: (organizations: { [id: string]: OrganizationData }, userId?: UserId) => Promise<void>;
}
