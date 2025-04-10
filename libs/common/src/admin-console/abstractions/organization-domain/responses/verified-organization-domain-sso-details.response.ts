import { BaseResponse } from "../../../../models/response/base.response";

export class VerifiedOrganizationDomainSsoDetailsResponse extends BaseResponse {
  organizationName: string;
  organizationIdentifier: string;
  domainName: string;

  constructor(response: any) {
    super(response);

    this.organizationName = this.getResponseProperty("organizationName");
    this.organizationIdentifier = this.getResponseProperty("organizationIdentifier");
    this.domainName = this.getResponseProperty("domainName");
  }
}
