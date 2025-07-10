// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BehaviorSubject } from "rxjs";

import { I18nService } from "../../../platform/abstractions/i18n.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { OrgDomainInternalServiceAbstraction } from "../../abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainResponse } from "../../abstractions/organization-domain/responses/organization-domain.response";

export class OrgDomainService implements OrgDomainInternalServiceAbstraction {
  protected _orgDomains$: BehaviorSubject<OrganizationDomainResponse[]> = new BehaviorSubject([]);

  orgDomains$ = this._orgDomains$.asObservable();

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
  ) {}

  get(orgDomainId: string): OrganizationDomainResponse {
    const orgDomains: OrganizationDomainResponse[] = this._orgDomains$.getValue();

    return orgDomains.find((orgDomain) => orgDomain.id === orgDomainId);
  }

  copyDnsTxt(dnsTxt: string): void {
    this.platformUtilsService.copyToClipboard(dnsTxt);
  }

  upsert(orgDomains: OrganizationDomainResponse[]): void {
    const existingOrgDomains: OrganizationDomainResponse[] = this._orgDomains$.getValue();

    orgDomains.forEach((orgDomain: OrganizationDomainResponse) => {
      // Determine if passed in orgDomain exists in existing array:
      const index = existingOrgDomains.findIndex(
        (existingOrgDomain) => existingOrgDomain.id === orgDomain.id,
      );
      if (index !== -1) {
        existingOrgDomains[index] = orgDomain;
      } else {
        existingOrgDomains.push(orgDomain);
      }
    });

    this._orgDomains$.next(existingOrgDomains);
  }

  replace(orgDomains: OrganizationDomainResponse[]): void {
    this._orgDomains$.next(orgDomains);
  }

  clearCache(): void {
    this._orgDomains$.next([]);
  }

  delete(orgDomainIds: string[]): void {
    const existingOrgDomains: OrganizationDomainResponse[] = this._orgDomains$.getValue();

    orgDomainIds.forEach((orgDomainId: string) => {
      const index = existingOrgDomains.findIndex(
        (existingOrgDomain) => existingOrgDomain.id === orgDomainId,
      );
      if (index !== -1) {
        existingOrgDomains.splice(index, 1);
      }
    });

    this._orgDomains$.next(existingOrgDomains);
  }
}
