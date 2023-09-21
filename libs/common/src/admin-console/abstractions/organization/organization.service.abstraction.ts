import { map, Observable } from "rxjs";

import { I18nService } from "../../../platform/abstractions/i18n.service";
import { Utils } from "../../../platform/misc/utils";
import { OrganizationData } from "../../models/data/organization.data";
import { Organization } from "../../models/domain/organization";

export function canAccessVaultTab(org: Organization): boolean {
  return org.canViewAssignedCollections || org.canViewAllCollections;
}

export function canAccessSettingsTab(org: Organization): boolean {
  return (
    org.isOwner ||
    org.canManagePolicies ||
    org.canManageSso ||
    org.canManageScim ||
    org.canAccessImportExport ||
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

export function canAccessAdmin(i18nService: I18nService) {
  return map<Organization[], Organization[]>((orgs) =>
    orgs.filter(canAccessOrgAdmin).sort(Utils.getSortFunction(i18nService, "name"))
  );
}

export function canAccessImportExport(i18nService: I18nService) {
  return map<Organization[], Organization[]>((orgs) =>
    orgs.filter((org) => org.canAccessImportExport).sort(Utils.getSortFunction(i18nService, "name"))
  );
}

/**
 * Returns `true` if a user is a member of an organization (rather than only being a ProviderUser)
 * @deprecated Use organizationService.memberOrganizations$ instead
 */
export function isMember(org: Organization): boolean {
  return org.isMember;
}

export abstract class OrganizationService {
  organizations$: Observable<Organization[]>;

  /**
   * Organizations that the user is a member of (excludes organizations that they only have access to via a provider)
   */
  memberOrganizations$: Observable<Organization[]>;

  get$: (id: string) => Observable<Organization | undefined>;
  get: (id: string) => Organization;
  getByIdentifier: (identifier: string) => Organization;
  getAll: (userId?: string) => Promise<Organization[]>;
  /**
   * @deprecated For the CLI only
   * @param id id of the organization
   */
  getFromState: (id: string) => Promise<Organization>;
  canManageSponsorships: () => Promise<boolean>;
  hasOrganizations: () => boolean;
}

export abstract class InternalOrganizationServiceAbstraction extends OrganizationService {
  replace: (organizations: { [id: string]: OrganizationData }) => Promise<void>;
  upsert: (OrganizationData: OrganizationData | OrganizationData[]) => Promise<void>;
}
