import { ListResponse } from "../../../models/response/list.response";
import { OrganizationDomainRequest } from "../../services/organization-domain/requests/organization-domain.request";

import { OrganizationDomainMiniResponse } from "./responses/organization-domain-mini.response";
import { OrganizationDomainResponse } from "./responses/organization-domain.response";
import { VerifiedOrganizationDomainSsoDetailsResponse } from "./responses/verified-organization-domain-sso-details.response";

export abstract class OrgDomainApiServiceAbstraction {
  /**
   * Retrieves every domain claimed by the organization. Requires the Manage SSO or Manage Policies
   * permission; callers without either are rejected with a 401, which logs the user out.
   */
  abstract getAllByOrgId(orgId: string): Promise<Array<OrganizationDomainResponse>>;
  /**
   * Retrieves the name and verification status of every domain claimed by the organization. Requires
   * the Manage SSO or Manage Users permission. Prefer this over {@link getAllByOrgId} when the DNS
   * verification token and verification job metadata are not needed.
   */
  abstract getAllMiniByOrgId(orgId: string): Promise<Array<OrganizationDomainMiniResponse>>;
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
