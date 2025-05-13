import { ListResponse } from "../../../models/response/list.response";
import { OrganizationSponsorshipInvitesResponse } from "../../models/response/organization-sponsorship-invites.response";

export abstract class OrganizationSponsorshipApiServiceAbstraction {
  abstract getOrganizationSponsorship(
    sponsoredOrgId: string,
  ): Promise<ListResponse<OrganizationSponsorshipInvitesResponse>>;

  abstract postResendSponsorshipOffer(
    sponsoringOrgId: string,
    friendlyName?: string,
  ): Promise<void>;

  abstract deleteRevokeSponsorship: (
    sponsoringOrganizationId: string,
    isAdminInitiated?: boolean,
  ) => Promise<void>;
}
