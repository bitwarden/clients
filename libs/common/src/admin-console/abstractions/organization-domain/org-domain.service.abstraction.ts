import { Observable } from "rxjs";

import { OrganizationDomainResponse } from "./responses/organization-domain.response";

export abstract class OrgDomainServiceAbstraction {
  abstract orgDomains$: Observable<OrganizationDomainResponse[]>;

  abstract get(orgDomainId: string): OrganizationDomainResponse;

  abstract copyDnsTxt(dnsTxt: string): void;
}

// Note: this separate class is designed to hold methods that are not
// meant to be used in components (e.g., data write methods)
export abstract class OrgDomainInternalServiceAbstraction extends OrgDomainServiceAbstraction {
  abstract upsert(orgDomains: OrganizationDomainResponse[]): void;
  abstract replace(orgDomains: OrganizationDomainResponse[]): void;
  abstract clearCache(): void;
  abstract delete(orgDomainIds: string[]): void;
}
