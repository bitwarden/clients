import { BaseResponse } from "../../../models/response/base.response";

export class PreValidateSponsorshipResponse extends BaseResponse {
  isTokenValid: boolean;
  isFreeFamilyPolicyEnabled: boolean;

  constructor(response: any) {
    super(response);
    this.isTokenValid = this.getResponseProperty("IsTokenValid");
    this.isFreeFamilyPolicyEnabled = this.getResponseProperty("IsFreeFamilyPolicyEnabled");
  }
}
