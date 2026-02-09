// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MasterPasswordAuthenticationData } from "../../../key-management/master-password/types/master-password.types";

import { SecretVerificationRequest } from "./secret-verification.request";

export class EmailTokenRequest extends SecretVerificationRequest {
  newEmail: string;

  /**
   * Creates an EmailTokenRequest using new KM data types.
   * This will eventually become the primary constructor once all callers are updated.
   * @see https://bitwarden.atlassian.net/browse/PM-30811
   */
  static forNewEmail(
    authenticationData: MasterPasswordAuthenticationData,
    newEmail: string,
  ): EmailTokenRequest {
    const request = new EmailTokenRequest();
    request.newEmail = newEmail;
    request.authenticateWith(authenticationData);
    return request;
  }
}
