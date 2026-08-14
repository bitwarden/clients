import { BaseResponse } from "../../../models/response/base.response";

/**
 * Email provider details. Embedded by the per-action
 * `TwoFactorEmail{Get,Update}Response` wrappers.
 */
export class TwoFactorEmailDetailsResponse extends BaseResponse {
  enabled: boolean;
  email: string;

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    this.email = this.getResponseProperty("Email");
  }
}
