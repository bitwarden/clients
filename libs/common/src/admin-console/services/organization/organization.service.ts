import { map, Observable, firstValueFrom } from "rxjs";
import { Jsonify } from "type-fest";

import { ORGANIZATIONS_DISK, StateProvider, UserKeyDefinition } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { InternalOrganizationServiceAbstraction } from "../../abstractions/organization/organization.service.abstraction";
import { OrganizationData } from "../../models/data/organization.data";
import { Organization } from "../../models/domain/organization";

/**
 * The `KeyDefinition` for accessing organization lists in application state.
 * @todo Ideally this wouldn't require a `fromJSON()` call, but `OrganizationData`
 * has some properties that contain functions. This should probably get
 * cleaned up.
 */
export const ORGANIZATIONS = UserKeyDefinition.record<OrganizationData>(
  ORGANIZATIONS_DISK,
  "organizations",
  {
    deserializer: (obj: Jsonify<OrganizationData>) => OrganizationData.fromJSON(obj),
    clearOn: ["logout"],
  },
);

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

/**
 * Map an observable stream of organizations down to a single organization.
 * @param `organizationId` The ID of the organization you'd like to subscribe to
 * @returns a function that can be used in `Observable<Organization[]>` pipes,
 * like `organizationService.organizations$`
 */
function mapToSingleOrganization(organizationId: string) {
  return map<Organization[], Organization>((orgs) => orgs?.find((o) => o.id === organizationId));
}

export class OrganizationService implements InternalOrganizationServiceAbstraction {
  organizations$: Observable<Organization[]> = this.getOrganizationsFromState$();
  memberOrganizations$: Observable<Organization[]> = this.organizations$.pipe(
    mapToExcludeProviderOrganizations(),
  );

  constructor(private stateProvider: StateProvider) {}

  get$(id: string): Observable<Organization | undefined> {
    return this.organizations$.pipe(mapToSingleOrganization(id));
  }

  getAll$(userId?: UserId): Observable<Organization[]> {
    return this.getOrganizationsFromState$(userId);
  }

  async getAll(userId?: string): Promise<Organization[]> {
    return await firstValueFrom(this.getOrganizationsFromState$(userId as UserId));
  }

  canManageSponsorships$ = this.organizations$.pipe(
    mapToExcludeOrganizationsWithoutFamilySponsorshipSupport(),
    mapToBooleanHasAnyOrganizations(),
  );

  async hasOrganizations(): Promise<boolean> {
    return await firstValueFrom(this.organizations$.pipe(mapToBooleanHasAnyOrganizations()));
  }

  async upsert(organization: OrganizationData, userId?: UserId): Promise<void> {
    await this.stateFor(userId).update((existingOrganizations) => {
      const organizations = existingOrganizations ?? {};
      organizations[organization.id] = organization;
      return organizations;
    });
  }

  async get(id: string): Promise<Organization> {
    return await firstValueFrom(this.organizations$.pipe(mapToSingleOrganization(id)));
  }

  /**
   * @deprecated For the CLI only
   * @param id id of the organization
   */
  async getFromState(id: string): Promise<Organization> {
    return await firstValueFrom(this.organizations$.pipe(mapToSingleOrganization(id)));
  }

  async replace(organizations: { [id: string]: OrganizationData }, userId?: UserId): Promise<void> {
    await this.stateFor(userId).update(() => organizations);
  }

  // Ideally this method would be renamed to organizations$() and the
  // $organizations observable as it stands would be removed. This will
  // require updates to callers, and so this method exists as a temporary
  // workaround until we have time & a plan to update callers.
  //
  // It can be thought of as "organizations$ but with a userId option".
  private getOrganizationsFromState$(userId?: UserId): Observable<Organization[] | undefined> {
    return this.stateFor(userId).state$.pipe(this.mapOrganizationRecordToArray());
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

  /**
   * Fetches the organization list from on disk state for the specified user.
   * @param userId the user ID to fetch the organization list for. Defaults to
   * the currently active user.
   * @returns an observable of organization state as it is stored on disk.
   */
  private stateFor(userId?: UserId) {
    return userId
      ? this.stateProvider.getUser(userId, ORGANIZATIONS)
      : this.stateProvider.getActive(ORGANIZATIONS);
  }
}
