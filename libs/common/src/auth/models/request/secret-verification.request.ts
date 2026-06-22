import { MasterPasswordAuthenticationData } from "../../../key-management/master-password/types/master-password.types";

export class SecretVerificationRequest {
  masterPasswordHash?: string;
  otp?: string;
  authRequestAccessCode?: string;

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
