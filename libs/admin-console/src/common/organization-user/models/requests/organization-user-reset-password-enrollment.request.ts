// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";

export class OrganizationUserResetPasswordEnrollmentRequest extends SecretVerificationRequest {
  resetPasswordKey: string;
}

export class OrganizationUserResetPasswordWithIdRequest extends OrganizationUserResetPasswordEnrollmentRequest {
  organizationId: string;
}
