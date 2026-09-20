import { ApiService } from "../../../abstractions/api.service";
import { UserId } from "../../../types/guid";
import { UserVerificationApiServiceAbstraction } from "../../abstractions/user-verification/user-verification-api.service.abstraction";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { VerifyOTPRequest } from "../../models/request/verify-otp.request";
import { MasterPasswordPolicyResponse } from "../../models/response/master-password-policy.response";

export class UserVerificationApiService implements UserVerificationApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  postAccountVerifyOTP(request: VerifyOTPRequest, userId: UserId): Promise<void> {
    return this.apiService.send("POST", "/accounts/verify-otp", request, userId, false);
  }
  async postAccountRequestOTP(userId: UserId): Promise<void> {
    return this.apiService.send("POST", "/accounts/request-otp", null, userId, false);
  }
  postAccountVerifyPassword(
    request: SecretVerificationRequest,
    userId: UserId,
  ): Promise<MasterPasswordPolicyResponse> {
    return this.apiService.send("POST", "/accounts/verify-password", request, userId, true);
  }
}
