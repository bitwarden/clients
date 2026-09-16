import { ListResponse } from "../../../models/response/list.response";
import { OrganizationDomainRequest } from "../../services/organization-domain/requests/organization-domain.request";

import { OrganizationDomainResponse } from "./responses/organization-domain.response";
import { VerifiedOrganizationDomainSsoDetailsResponse } from "./responses/verified-organization-domain-sso-details.response";

export abstract class OrgDomainApiServiceAbstraction {
  /**
   * Retrieves every domain claimed by the organization. Requires the Manage SSO or Manage Policies
   * permission; callers without either are rejected with a 401, which logs the user out.
   *
   * Callers that only need domain names should use
   * {@link OrganizationDomainsService.claimedDomains}, which goes through the SDK and also accepts
   * the Manage Users permission.
   */
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
  abstract getVerifiedOrgDomainsByEmail(
    email: string,
  ): Promise<ListResponse<VerifiedOrganizationDomainSsoDetailsResponse>>;
}
