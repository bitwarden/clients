import { ListResponse } from "../../../models/response/list.response";
import { OrganizationSponsorshipInvitesResponse } from "../../models/response/organization-sponsorship-invites.response";

export class OrganizationSponsorshipApiServiceAbstraction {
  getOrganizationSponsorship: (
    sponsoredOrgId: string,
  ) => Promise<ListResponse<OrganizationSponsorshipInvitesResponse>>;
}
