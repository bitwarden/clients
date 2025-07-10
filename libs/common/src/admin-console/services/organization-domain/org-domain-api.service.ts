import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { OrgDomainApiServiceAbstraction } from "../../abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrgDomainInternalServiceAbstraction } from "../../abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationDomainSsoDetailsResponse } from "../../abstractions/organization-domain/responses/organization-domain-sso-details.response";
import { OrganizationDomainResponse } from "../../abstractions/organization-domain/responses/organization-domain.response";
import { VerifiedOrganizationDomainSsoDetailsResponse } from "../../abstractions/organization-domain/responses/verified-organization-domain-sso-details.response";

import { OrganizationDomainSsoDetailsRequest } from "./requests/organization-domain-sso-details.request";
import { OrganizationDomainRequest } from "./requests/organization-domain.request";

export class OrgDomainApiService implements OrgDomainApiServiceAbstraction {
  constructor(
    private orgDomainService: OrgDomainInternalServiceAbstraction,
    private apiService: ApiService,
  ) {}

  async getAllByOrgId(orgId: string): Promise<Array<OrganizationDomainResponse>> {
    const listResponse: ListResponse<any> = await this.apiService.send(
      "GET",
      `/organizations/${orgId}/domain`,
      null,
      true,
      true,
    );

    const orgDomains = listResponse.data.map(
      (resultOrgDomain: any) => new OrganizationDomainResponse(resultOrgDomain),
    );

    this.orgDomainService.replace(orgDomains);

    return orgDomains;
  }

  async getByOrgIdAndOrgDomainId(
    orgId: string,
    orgDomainId: string,
  ): Promise<OrganizationDomainResponse> {
    const result = await this.apiService.send(
      "GET",
      `/organizations/${orgId}/domain/${orgDomainId}`,
      null,
      true,
      true,
    );

    const response = new OrganizationDomainResponse(result);

    this.orgDomainService.upsert([response]);

    return response;
  }

  async post(
    orgId: string,
    orgDomainReq: OrganizationDomainRequest,
  ): Promise<OrganizationDomainResponse> {
    const result = await this.apiService.send(
      "POST",
      `/organizations/${orgId}/domain`,
      orgDomainReq,
      true,
      true,
    );

    const response = new OrganizationDomainResponse(result);

    this.orgDomainService.upsert([response]);

    return response;
  }

  async verify(orgId: string, orgDomainId: string): Promise<OrganizationDomainResponse> {
    const result = await this.apiService.send(
      "POST",
      `/organizations/${orgId}/domain/${orgDomainId}/verify`,
      null,
      true,
      true,
    );

    const response = new OrganizationDomainResponse(result);

    this.orgDomainService.upsert([response]);

    return response;
  }

  async delete(orgId: string, orgDomainId: string): Promise<any> {
    await this.apiService.send(
      "DELETE",
      `/organizations/${orgId}/domain/${orgDomainId}`,
      null,
      true,
      false,
    );
    this.orgDomainService.delete([orgDomainId]);
  }

  async getClaimedOrgDomainByEmail(email: string): Promise<OrganizationDomainSsoDetailsResponse> {
    const result = await this.apiService.send(
      "POST",
      `/organizations/domain/sso/details`,
      new OrganizationDomainSsoDetailsRequest(email),
      false, // anonymous
      true,
    );
    const response = new OrganizationDomainSsoDetailsResponse(result);

    return response;
  }

  async getVerifiedOrgDomainsByEmail(
    email: string,
  ): Promise<ListResponse<VerifiedOrganizationDomainSsoDetailsResponse>> {
    const result = await this.apiService.send(
      "POST",
      `/organizations/domain/sso/verified`,
      new OrganizationDomainSsoDetailsRequest(email),
      false, // anonymous
      true,
    );

    return new ListResponse(result, VerifiedOrganizationDomainSsoDetailsResponse);
  }
}
