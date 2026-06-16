import { WebAuthnPrfDecryptionOptionResponse } from "../../../auth/models/response/user-decryption-options/webauthn-prf-decryption-option.response";
import { BaseResponse } from "../../../models/response/base.response";
import { MasterPasswordUnlockResponse } from "../../master-password/models/response/master-password-unlock.response";
import { V2UpgradeTokenResponse } from "../../upgrade-token/models/response/v2-upgrade-token.response";

export class UserDecryptionResponse extends BaseResponse {
  masterPasswordUnlock?: MasterPasswordUnlockResponse;

  /**
   * The sync service returns an array of WebAuthn PRF options.
   */
  webAuthnPrfOptions?: WebAuthnPrfDecryptionOptionResponse[];

  v2UpgradeToken?: V2UpgradeTokenResponse;

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

    const v2UpgradeToken = this.getResponseProperty("V2UpgradeToken");
    if (v2UpgradeToken != null && typeof v2UpgradeToken === "object") {
      this.v2UpgradeToken = new V2UpgradeTokenResponse(v2UpgradeToken);
    }
  }
}
