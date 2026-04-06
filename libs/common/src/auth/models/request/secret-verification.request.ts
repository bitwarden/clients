// FIXME: Update this file to be type safe and remove this and next line

import { MasterPasswordAuthenticationData } from "@bitwarden/common/key-management/master-password/types/master-password.types";

// @ts-strict-ignore
export class SecretVerificationRequest {
  masterPasswordHash: string;
  otp: string;
  authRequestAccessCode: string;

  /**
   * Mutates this request to include the master password authentication data, to authenticate the request.
   */
  authenticateWith(
    masterPasswordAuthenticationData: MasterPasswordAuthenticationData,
  ): SecretVerificationRequest {
    this.masterPasswordHash = masterPasswordAuthenticationData.masterPasswordAuthenticationHash;
    return this;
  }
}
