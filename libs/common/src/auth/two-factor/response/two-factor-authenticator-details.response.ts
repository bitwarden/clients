import { BaseResponse } from "../../../models/response/base.response";

/**
 * Authenticator (TOTP) provider details. Embedded by the per-action
 * `TwoFactorAuthenticator{Get,Update}Response` wrappers.
 */
export class TwoFactorAuthenticatorDetailsResponse extends BaseResponse {
  enabled: boolean;
  key: string;

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    this.key = this.getResponseProperty("Key");
  }
}
