import { BaseResponse } from "../../../../models/response/base.response";

export class OrganizationDomainSsoDetailsResponse extends BaseResponse {
  id: string;
  organizationIdentifier: string;
  ssoAvailable: boolean;
  domainName: string;
  verifiedDate?: Date;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("id");
    this.organizationIdentifier = this.getResponseProperty("organizationIdentifier");
    this.ssoAvailable = this.getResponseProperty("ssoAvailable");
    this.domainName = this.getResponseProperty("domainName");
    this.verifiedDate = this.getResponseProperty("verifiedDate");
  }
}
