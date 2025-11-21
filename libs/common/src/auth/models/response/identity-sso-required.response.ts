import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class IdentitySsoRequiredResponse extends BaseResponse {
  ssoOrganizationIdentifier: string | null;

  constructor(response: any) {
    super(response);
    this.ssoOrganizationIdentifier = this.getResponseProperty("SsoOrganizationIdentifier");
  }
}
