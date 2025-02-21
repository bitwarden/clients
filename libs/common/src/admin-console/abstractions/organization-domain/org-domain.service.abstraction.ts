// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { OrganizationDomainResponse } from "./responses/organization-domain.response";

export abstract class OrgDomainServiceAbstraction {
  orgDomains$: Observable<OrganizationDomainResponse[]>;

  get: (orgDomainId: string) => OrganizationDomainResponse;

  copyDnsTxt: (dnsTxt: string) => void;
}

// Note: this separate class is designed to hold methods that are not
// meant to be used in components (e.g., data write methods)
export abstract class OrgDomainInternalServiceAbstraction extends OrgDomainServiceAbstraction {
  upsert: (orgDomains: OrganizationDomainResponse[]) => void;
  replace: (orgDomains: OrganizationDomainResponse[]) => void;
  clearCache: () => void;
  delete: (orgDomainIds: string[]) => void;
}
