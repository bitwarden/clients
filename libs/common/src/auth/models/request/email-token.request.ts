// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MasterPasswordAuthenticationData } from "../../../key-management/master-password/types/master-password.types";

import { SecretVerificationRequest } from "./secret-verification.request";

export class EmailTokenRequest extends SecretVerificationRequest {
  newEmail: string;
  masterPasswordHash: string;
  /**
   * Creates an EmailTokenRequest using new KM types.
   * This will eventually become the primary constructor once all callers are updated.
   *
   * https://bitwarden.atlassian.net/browse/PM-30811
   */
  static newConstructor(authenticationData: MasterPasswordAuthenticationData, newEmail: string) {
    const emailTokenRequest = new EmailTokenRequest();

    emailTokenRequest.newEmail = newEmail;
    emailTokenRequest.masterPasswordHash = authenticationData.masterPasswordAuthenticationHash;

    return emailTokenRequest;
  }
}
