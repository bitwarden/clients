import { ListResponse } from "../../../models/response/list.response";
import { OrganizationSponsorshipInvitesResponse } from "../../models/response/organization-sponsorship-invites.response";

export abstract class OrganizationSponsorshipApiServiceAbstraction {
  abstract getOrganizationSponsorship(
    sponsoredOrgId: string,
  ): Promise<ListResponse<OrganizationSponsorshipInvitesResponse>>;
}
