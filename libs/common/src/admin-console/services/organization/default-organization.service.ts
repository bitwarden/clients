// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { map, Observable } from "rxjs";

import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { InternalOrganizationServiceAbstraction } from "../../abstractions/organization/organization.service.abstraction";
import { OrganizationData } from "../../models/data/organization.data";
import { Organization } from "../../models/domain/organization";

import { ORGANIZATIONS } from "./organization.state";

/**
 * Filter out organizations from an observable that __do not__ offer a
 * families-for-enterprise sponsorship to members.
 * @returns a function that can be used in `Observable<Organization[]>` pipes,
 * like `organizationService.organizations$`
 */
function mapToExcludeOrganizationsWithoutFamilySponsorshipSupport() {
  return map<Organization[], Organization[]>((orgs) => orgs.filter((o) => o.canManageSponsorships));
}

/**
 * Filter out organizations from an observable that the organization user
 * __is not__ a direct member of. This will exclude organizations only
 * accessible as a provider.
 * @returns a function that can be used in `Observable<Organization[]>` pipes,
 * like `organizationService.organizations$`
 */
function mapToExcludeProviderOrganizations() {
  return map<Organization[], Organization[]>((orgs) => orgs.filter((o) => o.isMember));
}

/**
 * Map an observable stream of organizations down to a boolean indicating
 * if any organizations exist (`orgs.length > 0`).
 * @returns a function that can be used in `Observable<Organization[]>` pipes,
 * like `organizationService.organizations$`
 */
function mapToBooleanHasAnyOrganizations() {
  return map<Organization[], boolean>((orgs) => orgs.length > 0);
}

export class DefaultOrganizationService implements InternalOrganizationServiceAbstraction {
  memberOrganizations$(userId: UserId): Observable<Organization[]> {
    return this.organizations$(userId).pipe(mapToExcludeProviderOrganizations());
  }

  constructor(private stateProvider: StateProvider) {}

  canManageSponsorships$(userId: UserId) {
    return this.organizations$(userId).pipe(
      mapToExcludeOrganizationsWithoutFamilySponsorshipSupport(),
      mapToBooleanHasAnyOrganizations(),
    );
  }

  familySponsorshipAvailable$(userId: UserId) {
    return this.organizations$(userId).pipe(
      map((orgs) => orgs.some((o) => o.familySponsorshipAvailable)),
    );
  }

  hasOrganizations(userId: UserId): Observable<boolean> {
    return this.organizations$(userId).pipe(mapToBooleanHasAnyOrganizations());
  }

  async upsert(organization: OrganizationData, userId: UserId): Promise<void> {
    await this.organizationState(userId).update((existingOrganizations) => {
      const organizations = existingOrganizations ?? {};
      organizations[organization.id] = organization;
      return organizations;
    });
  }

  async replace(organizations: { [id: string]: OrganizationData }, userId: UserId): Promise<void> {
    await this.organizationState(userId).update(() => organizations);
  }

  organizations$(userId: UserId): Observable<Organization[] | undefined> {
    return this.organizationState(userId).state$.pipe(this.mapOrganizationRecordToArray());
  }

  private organizationState(userId: UserId) {
    return this.stateProvider.getUser(userId, ORGANIZATIONS);
  }

  /**
   * Accepts a record of `OrganizationData`, which is how we store the
   * organization list as a JSON object on disk, to an array of
   * `Organization`, which is how the data is published to callers of the
   * service.
   * @returns a function that can be used to pipe organization data from
   * stored state to an exposed object easily consumable by others.
   */
  private mapOrganizationRecordToArray() {
    return map<Record<string, OrganizationData>, Organization[]>((orgs) =>
      Object.values(orgs ?? {})?.map((o) => new Organization(o)),
    );
  }
}
