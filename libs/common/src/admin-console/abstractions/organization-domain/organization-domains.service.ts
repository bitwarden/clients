import { ClaimedDomain } from "@bitwarden/sdk-internal";

import { OrganizationId, UserId } from "../../../types/guid";

export abstract class OrganizationDomainsService {
  /**
   * Retrieves every domain the organization has claimed, along with whether each one has been
   * verified.
   *
   * Requires the Manage Users or Manage SSO permission. Prefer this over
   * {@link OrgDomainApiServiceAbstraction.getAllByOrgId} when the DNS verification token and
   * verification job metadata are not needed: that endpoint requires Manage SSO, and calling it
   * without that permission returns a 401 which the api service treats as an invalid access token,
   * logging the user out.
   */
  abstract claimedDomains(userId: UserId, organizationId: OrganizationId): Promise<ClaimedDomain[]>;
}
