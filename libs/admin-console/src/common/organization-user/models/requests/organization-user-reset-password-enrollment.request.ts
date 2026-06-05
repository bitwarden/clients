import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";

export class OrganizationUserResetPasswordEnrollmentRequest extends SecretVerificationRequest {
  resetPasswordKey?: string;
}

export class OrganizationUserResetPasswordWithIdRequest extends OrganizationUserResetPasswordEnrollmentRequest {
  constructor(public organizationId: string) {
    super();
  }
}
