import { BaseResponse } from "../../../models/response/base.response";

/**
 * Duo provider details for both user and organization scopes. Embedded by the per-action
 * `TwoFactorDuo{Get,Update}Response` and `TwoFactorOrganizationDuo{Get,Update}Response` wrappers.
 */
export class TwoFactorDuoDetailsResponse extends BaseResponse {
  enabled: boolean;
  host: string;
  clientId: string;
  clientSecret: string;

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    this.host = this.getResponseProperty("Host");
    this.clientId = this.getResponseProperty("ClientId");
    this.clientSecret = this.getResponseProperty("ClientSecret");
  }
}
