import { BehaviorSubject, concatMap, map, Observable } from "rxjs";

import { InternalOrganizationService as InternalOrganizationServiceAbstraction } from "../../abstractions/organization/organization.service.abstraction";
import { StateService } from "../../abstractions/state.service";
import { OrganizationData } from "../../models/data/organization.data";
import { Organization } from "../../models/domain/organization";
import { Guid } from "../../types/guid";

export class OrganizationService implements InternalOrganizationServiceAbstraction {
  protected _organizations = new BehaviorSubject<Organization[]>([]);

  organizations$ = this._organizations.asObservable();

  constructor(private stateService: StateService) {
    this.stateService.activeAccountUnlocked$
      .pipe(
        concatMap(async (unlocked) => {
          if (!unlocked) {
            this._organizations.next([]);
            return;
          }

          const data = await this.stateService.getOrganizations();
          this.updateObservables(data);
        })
      )
      .subscribe();
  }

  get$(id: string): Observable<Organization | undefined> {
    return this.organizations$.pipe(map((orgs) => orgs.find((o) => o.id === id)));
  }

  async getAll(userId?: Guid): Promise<Organization[]> {
    const organizationsMap = await this.stateService.getOrganizations({ userId: userId });
    return Object.values(organizationsMap || {}).map((o) => new Organization(o));
  }

  async canManageSponsorships(): Promise<boolean> {
    const organizations = this._organizations.getValue();
    return organizations.some(
      (o) => o.familySponsorshipAvailable || o.familySponsorshipFriendlyName !== null
    );
  }

  hasOrganizations(): boolean {
    const organizations = this._organizations.getValue();
    return organizations.length > 0;
  }

  async upsert(organization: OrganizationData): Promise<void> {
    let organizations = await this.stateService.getOrganizations();
    if (organizations == null) {
      organizations = {};
    }

    organizations[organization.id] = organization;

    await this.replace(organizations);
  }

  async delete(id: string): Promise<void> {
    const organizations = await this.stateService.getOrganizations();
    if (organizations == null) {
      return;
    }

    if (organizations[id] == null) {
      return;
    }

    delete organizations[id];
    await this.replace(organizations);
  }

  get(id: string): Organization {
    const organizations = this._organizations.getValue();

    return organizations.find((organization) => organization.id === id);
  }

  /**
   * @deprecated For the CLI only
   * @param id id of the organization
   */
  async getFromState(id: string): Promise<Organization> {
    const organizationsMap = await this.stateService.getOrganizations();
    const organization = organizationsMap[id];
    if (organization == null) {
      return null;
    }

    return new Organization(organization);
  }

  getByIdentifier(identifier: string): Organization {
    const organizations = this._organizations.getValue();

    return organizations.find((organization) => organization.identifier === identifier);
  }

  async replace(organizations: { [id: string]: OrganizationData }) {
    await this.stateService.setOrganizations(organizations);
    this.updateObservables(organizations);
  }

  private updateObservables(organizationsMap: { [id: string]: OrganizationData }) {
    const organizations = Object.values(organizationsMap || {}).map((o) => new Organization(o));
    this._organizations.next(organizations);
  }
}
