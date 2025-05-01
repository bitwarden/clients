import { BaseResponse } from "../../../models/response/base.response";

export class OrganizationSponsorshipResponse extends BaseResponse {
  isPolicyEnabled: string;

  constructor(response: any) {
    super(response);
    this.isPolicyEnabled = this.getResponseProperty("IsPolicyEnabled");
  }
}
