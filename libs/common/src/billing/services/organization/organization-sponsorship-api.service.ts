import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { OrganizationSponsorshipApiServiceAbstraction } from "../../abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { OrganizationSponsorshipInvitesResponse } from "../../models/response/organization-sponsorship-invites.response";

export class OrganizationSponsorshipApiService
  implements OrganizationSponsorshipApiServiceAbstraction
{
  constructor(private apiService: ApiService) {}
  async getOrganizationSponsorship(
    sponsoredOrgId: string,
  ): Promise<ListResponse<OrganizationSponsorshipInvitesResponse>> {
    const r = await this.apiService.send(
      "GET",
      "/organization/sponsorship/" + sponsoredOrgId + "/sponsored",
      null,
      true,
      true,
    );
    return new ListResponse(r, OrganizationSponsorshipInvitesResponse);
  }
}
