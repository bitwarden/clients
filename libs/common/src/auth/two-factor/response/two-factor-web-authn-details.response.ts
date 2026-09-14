import { BaseResponse } from "../../../models/response/base.response";

/**
 * WebAuthn provider details. Embedded by the per-action
 * `TwoFactorWebAuthn{Get,Update,Delete}Response` wrappers.
 */
export class TwoFactorWebAuthnDetailsResponse extends BaseResponse {
  enabled: boolean;
  keys: WebAuthnKeyResponse[];

  constructor(response: any) {
    super(response);
    this.enabled = this.getResponseProperty("Enabled");
    const keys = this.getResponseProperty("Keys");
    this.keys = keys == null ? null : keys.map((k: any) => new WebAuthnKeyResponse(k));
  }
}

export class WebAuthnKeyResponse extends BaseResponse {
  name: string;
  id: number;
  migrated: boolean;

  constructor(response: any) {
    super(response);
    this.name = this.getResponseProperty("Name");
    this.id = this.getResponseProperty("Id");
    this.migrated = this.getResponseProperty("Migrated");
  }
}
