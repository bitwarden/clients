// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { ListResponse } from "../../../models/response/list.response";
import { OrganizationSponsorshipInvitesResponse } from "../../models/response/organization-sponsorship-invites.response";

export class OrganizationSponsorshipApiServiceAbstraction {
  getOrganizationSponsorship: (
    sponsoredOrgId: string,
  ) => Promise<ListResponse<OrganizationSponsorshipInvitesResponse>>;
}
