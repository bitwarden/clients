import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class OrganizationInviteLinkValidateEmailDomainResponse extends BaseResponse {
  isAllowed: boolean;

  constructor(response: any) {
    super(response);
    this.isAllowed = this.getResponseProperty("IsAllowed");
  }
}
