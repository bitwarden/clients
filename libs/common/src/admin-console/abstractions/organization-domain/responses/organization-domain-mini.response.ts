import { BaseResponse } from "../../../../models/response/base.response";

/**
 * A slim view of an organization's claimed domain, returned by `GET /organizations/{orgId}/domain/mini`.
 *
 * Unlike {@link OrganizationDomainResponse}, it carries no DNS verification token or verification job
 * metadata, so the endpoint is available to members who can manage users as well as those who can manage
 * SSO. Use it when all you need is which domains the organization has claimed.
 */
export class OrganizationDomainMiniResponse extends BaseResponse {
  domainName: string;
  verifiedDate?: string;

  constructor(response: any) {
    super(response);
    this.domainName = this.getResponseProperty("domainName");
    this.verifiedDate = this.getResponseProperty("verifiedDate");
  }
}
