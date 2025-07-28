// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { UnsignedSharedKey } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class OrganizationUserResetPasswordEnrollmentRequest extends SecretVerificationRequest {
  resetPasswordKey: UnsignedSharedKey;

  constructor(unsignedSharedKey: UnsignedSharedKey) {
    super();
    this.resetPasswordKey = unsignedSharedKey;
  }
}

export class OrganizationUserResetPasswordWithIdRequest extends OrganizationUserResetPasswordEnrollmentRequest {
  organizationId: string;
}
