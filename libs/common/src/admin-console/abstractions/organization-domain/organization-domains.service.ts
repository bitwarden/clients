import { OrganizationId, UserId } from "../../../types/guid";

export abstract class OrganizationDomainsService {
  /**
   * Retrieves the names of every domain the organization has claimed and verified, for example
   * `example.com`. Domains that have been claimed but not yet verified are excluded.
   *
   * Requires the Manage Users or Manage SSO permission. Prefer this over
   * {@link OrgDomainApiServiceAbstraction.getAllByOrgId} when the DNS verification token and
   * verification job metadata are not needed: that endpoint requires Manage SSO, and calling it
   * without that permission returns a 401 which the api service treats as an invalid access token,
   * logging the user out.
   */
  abstract verifiedDomains(userId: UserId, organizationId: OrganizationId): Promise<string[]>;
}
