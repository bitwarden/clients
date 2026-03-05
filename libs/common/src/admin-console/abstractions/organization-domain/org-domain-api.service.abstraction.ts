import { ListResponse } from "../../../models/response/list.response";
import { OrganizationDomainRequest } from "../../services/organization-domain/requests/organization-domain.request";

import { OrganizationDomainSsoDetailsResponse } from "./responses/organization-domain-sso-details.response";
import { OrganizationDomainResponse } from "./responses/organization-domain.response";
import { VerifiedOrganizationDomainSsoDetailsResponse } from "./responses/verified-organization-domain-sso-details.response";

export abstract class OrgDomainApiServiceAbstraction {
  abstract getAllByOrgId(orgId: string): Promise<Array<OrganizationDomainResponse>>;
  abstract getByOrgIdAndOrgDomainId(
    orgId: string,
    orgDomainId: string,
  ): Promise<OrganizationDomainResponse>;
  abstract post(
    orgId: string,
    orgDomain: OrganizationDomainRequest,
  ): Promise<OrganizationDomainResponse>;
  abstract verify(orgId: string, orgDomainId: string): Promise<OrganizationDomainResponse>;
  abstract delete(orgId: string, orgDomainId: string): Promise<any>;
  abstract getClaimedOrgDomainByEmail(email: string): Promise<OrganizationDomainSsoDetailsResponse>;
  abstract getVerifiedOrgDomainsByEmail(
    email: string,
  ): Promise<ListResponse<VerifiedOrganizationDomainSsoDetailsResponse>>;
}
