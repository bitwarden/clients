import { MasterPasswordUnlockData, UserDecryption } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../../models/response/base.response";

import {
  IKeyConnectorUserDecryptionOptionServerResponse,
  KeyConnectorUserDecryptionOptionResponse,
} from "./key-connector-user-decryption-option.response";
import {
  ITrustedDeviceUserDecryptionOptionServerResponse,
  TrustedDeviceUserDecryptionOptionResponse,
} from "./trusted-device-user-decryption-option.response";
import {
  IWebAuthnPrfDecryptionOptionServerResponse,
  WebAuthnPrfDecryptionOptionResponse,
} from "./webauthn-prf-decryption-option.response";

export interface IUserDecryptionOptionsServerResponse {
  HasMasterPassword: boolean;
  MasterPasswordUnlock?: MasterPasswordUnlockData;
  TrustedDeviceOption?: ITrustedDeviceUserDecryptionOptionServerResponse;
  KeyConnectorOption?: IKeyConnectorUserDecryptionOptionServerResponse;
  WebAuthnPrfOption?: IWebAuthnPrfDecryptionOptionServerResponse;
}

export class UserDecryptionOptionsResponse extends BaseResponse {
  hasMasterPassword: boolean;
  masterPasswordUnlock?: MasterPasswordUnlockData;
  trustedDeviceOption?: TrustedDeviceUserDecryptionOptionResponse;
  keyConnectorOption?: KeyConnectorUserDecryptionOptionResponse;
  webAuthnPrfOption?: WebAuthnPrfDecryptionOptionResponse;

  constructor(response: IUserDecryptionOptionsServerResponse) {
    super(response);

    this.hasMasterPassword = this.getResponseProperty("HasMasterPassword");

    const masterPasswordUnlock = this.getResponseProperty("MasterPasswordUnlock");
    if (masterPasswordUnlock != null && typeof masterPasswordUnlock === "object") {
      this.masterPasswordUnlock =
        UserDecryption.get_master_password_unlock_data(masterPasswordUnlock);
    }

    if (response.TrustedDeviceOption) {
      this.trustedDeviceOption = new TrustedDeviceUserDecryptionOptionResponse(
        this.getResponseProperty("TrustedDeviceOption"),
      );
    }
    if (response.KeyConnectorOption) {
      this.keyConnectorOption = new KeyConnectorUserDecryptionOptionResponse(
        this.getResponseProperty("KeyConnectorOption"),
      );
    }
    if (response.WebAuthnPrfOption) {
      this.webAuthnPrfOption = new WebAuthnPrfDecryptionOptionResponse(
        this.getResponseProperty("WebAuthnPrfOption"),
      );
    }
  }
}
