import { BaseResponse } from "../../../../models/response/base.response";

/**
 * Server response format for TideCloak user decryption option.
 */
export interface ITideCloakUserDecryptionOptionServerResponse {
  /** The TideCloak service URL for SDK initialization */
  TideCloakUrl: string;
  /** The encrypted master key (encrypted via TideCloak SMPC) */
  EncryptedMasterKey?: string;
}

/**
 * Response model for TideCloak user decryption option.
 * This is sent from the server when a user is configured to use TideCloak
 * for key management via Secure Multiparty Computation (SMPC).
 */
export class TideCloakUserDecryptionOptionResponse extends BaseResponse {
  /** The TideCloak service URL for SDK initialization */
  tideCloakUrl: string;
  /** The encrypted master key stored on the server */
  encryptedMasterKey?: string;

  constructor(response: ITideCloakUserDecryptionOptionServerResponse) {
    super(response);
    this.tideCloakUrl = this.getResponseProperty("TideCloakUrl");
    this.encryptedMasterKey = this.getResponseProperty("EncryptedMasterKey");
  }
}
