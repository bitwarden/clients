import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { OrganizationSponsorshipApiServiceAbstraction } from "../../abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { OrganizationSponsorshipInvitesResponse } from "../../models/response/organization-sponsorship-invites.response";

export class OrganizationSponsorshipApiService
  implements OrganizationSponsorshipApiServiceAbstraction
{
  constructor(
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
  ) {}
  async getOrganizationSponsorship(
    sponsoredOrgId: string,
  ): Promise<ListResponse<OrganizationSponsorshipInvitesResponse>> {
    const r = await this.apiService.send(
      "GET",
      "/organization/sponsorship/" +
        (this.platformUtilsService.isSelfHost() ? "self-hosted/" : "") +
        sponsoredOrgId +
        "/sponsored",
      null,
      true,
      true,
    );
    return new ListResponse(r, OrganizationSponsorshipInvitesResponse);
  }

  async postResendSponsorshipOffer(
    sponsoringOrgId: string,
    sponsoredFriendlyName?: string,
  ): Promise<void> {
    let url = "/organization/sponsorship/" + sponsoringOrgId + "/families-for-enterprise/resend";

    // Add the query parameter if sponsoredOrgUserId is provided
    if (sponsoredFriendlyName) {
      url += `?sponsoredFriendlyName=${encodeURIComponent(sponsoredFriendlyName)}`;
    }

    return await this.apiService.send("POST", url, null, true, false);
  }

  async deleteRevokeSponsorship(
    sponsoringOrganizationId: string,
    isAdminInitiated: boolean = false,
  ): Promise<void> {
    const basePath = "/organization/sponsorship/";
    const hostPath = this.platformUtilsService.isSelfHost() ? "self-hosted/" : "";

    return await this.apiService.send(
      "DELETE",
      basePath + hostPath + sponsoringOrganizationId,
      null,
      true,
      false,
    );
  }

  async deleteAdminInitiatedRevokeSponsorship(
    sponsoringOrganizationId: string,
    sponsoredFriendlyName: string,
  ): Promise<void> {
    const basePath = "/organization/sponsorship/";
    const hostPath = this.platformUtilsService.isSelfHost() ? "self-hosted/" : "";
    return await this.apiService.send(
      "DELETE",
      basePath +
        hostPath +
        sponsoringOrganizationId +
        "/" +
        encodeURIComponent(sponsoredFriendlyName) +
        "/revoke",
      null,
      true,
      false,
    );
  }
}
