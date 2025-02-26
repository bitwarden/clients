// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ListResponse } from "../../../models/response/list.response";
import { OrganizationDomainRequest } from "../../services/organization-domain/requests/organization-domain.request";

import { OrganizationDomainSsoDetailsResponse } from "./responses/organization-domain-sso-details.response";
import { OrganizationDomainResponse } from "./responses/organization-domain.response";
import { VerifiedOrganizationDomainSsoDetailsResponse } from "./responses/verified-organization-domain-sso-details.response";

export abstract class OrgDomainApiServiceAbstraction {
  getAllByOrgId: (orgId: string) => Promise<Array<OrganizationDomainResponse>>;
  getByOrgIdAndOrgDomainId: (
    orgId: string,
    orgDomainId: string,
  ) => Promise<OrganizationDomainResponse>;
  post: (
    orgId: string,
    orgDomain: OrganizationDomainRequest,
  ) => Promise<OrganizationDomainResponse>;
  verify: (orgId: string, orgDomainId: string) => Promise<OrganizationDomainResponse>;
  delete: (orgId: string, orgDomainId: string) => Promise<any>;
  getClaimedOrgDomainByEmail: (email: string) => Promise<OrganizationDomainSsoDetailsResponse>;
  getVerifiedOrgDomainsByEmail: (
    email: string,
  ) => Promise<ListResponse<VerifiedOrganizationDomainSsoDetailsResponse>>;
}
