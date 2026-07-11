import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * Response from POST /organizations/{orgId}/rotation/daemons — the one-time registration payload.
 *
 * NOTE: These fields reflect the **planned** server contract (server not yet implemented).
 * The `clientSecret` is returned **exactly once** in this response and never again; the
 * UI must present it for the operator to copy before dismissing the dialog.
 * Wire property names are PascalCase.
 */
export class DaemonRegistrationResponse extends BaseResponse {
  /** The newly registered daemon's stable identifier (UUID). */
  id: string;
  /**
   * The API key identifier component of the daemon's credential.
   * Combined with `clientSecret` and the local key material to construct the daemon token:
   * `0.daemon.{apiKeyId}.{clientSecret}:{keyMaterialBase64}`.
   */
  apiKeyId: string;
  /**
   * The client secret component of the daemon's credential.
   * Shown once — the server does not store this in recoverable form. If lost,
   * the operator must revoke the daemon and re-register.
   */
  clientSecret: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.apiKeyId = this.getResponseProperty("ApiKeyId");
    this.clientSecret = this.getResponseProperty("ClientSecret");
  }
}
