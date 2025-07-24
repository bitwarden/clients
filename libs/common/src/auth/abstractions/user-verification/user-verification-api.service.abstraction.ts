import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { VerifyOTPRequest } from "../../models/request/verify-otp.request";
import { MasterPasswordPolicyResponse } from "../../models/response/master-password-policy.response";

export abstract class UserVerificationApiServiceAbstraction {
  abstract postAccountVerifyOTP(request: VerifyOTPRequest): Promise<void>;
  abstract postAccountRequestOTP(): Promise<void>;
  abstract postAccountVerifyPassword(
    request: SecretVerificationRequest,
  ): Promise<MasterPasswordPolicyResponse>;
}
