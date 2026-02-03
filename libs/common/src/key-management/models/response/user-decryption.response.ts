import { WebAuthnPrfDecryptionOptionResponse } from "../../../auth/models/response/user-decryption-options/webauthn-prf-decryption-option.response";
import { BaseResponse } from "../../../models/response/base.response";
import { MasterPasswordUnlockResponse } from "../../master-password/models/response/master-password-unlock.response";

export class UserDecryptionResponse extends BaseResponse {
  masterPasswordUnlock?: MasterPasswordUnlockResponse;

  /**
   * The sync service returns an array of WebAuthn PRF options.
   */
  webAuthnPrfOptions?: WebAuthnPrfDecryptionOptionResponse[];

  constructor(response: unknown) {
    super(response);

    const masterPasswordUnlock = this.getResponseProperty("MasterPasswordUnlock");
    if (masterPasswordUnlock != null && typeof masterPasswordUnlock === "object") {
      this.masterPasswordUnlock = new MasterPasswordUnlockResponse(masterPasswordUnlock);
    }

    const webAuthnPrfOptions = this.getResponseProperty("WebAuthnPrfOptions");
    if (webAuthnPrfOptions != null && Array.isArray(webAuthnPrfOptions)) {
      this.webAuthnPrfOptions = webAuthnPrfOptions.map(
        (option) => new WebAuthnPrfDecryptionOptionResponse(option),
      );
    }
  }
}
