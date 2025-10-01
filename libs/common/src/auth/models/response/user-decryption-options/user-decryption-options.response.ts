import { MasterPasswordUnlockResponse } from "../../../../key-management/master-password/models/response/master-password-unlock.response";
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
  MasterPasswordUnlock?: unknown;
  TrustedDeviceOption?: ITrustedDeviceUserDecryptionOptionServerResponse;
  KeyConnectorOption?: IKeyConnectorUserDecryptionOptionServerResponse;
  WebAuthnPrfOptions?: IWebAuthnPrfDecryptionOptionServerResponse[];
}

export class UserDecryptionOptionsResponse extends BaseResponse {
  hasMasterPassword: boolean;
  masterPasswordUnlock?: MasterPasswordUnlockResponse;
  trustedDeviceOption?: TrustedDeviceUserDecryptionOptionResponse;
  keyConnectorOption?: KeyConnectorUserDecryptionOptionResponse;
  webAuthnPrfOptions?: WebAuthnPrfDecryptionOptionResponse[];

  constructor(response: IUserDecryptionOptionsServerResponse) {
    super(response);

    this.hasMasterPassword = this.getResponseProperty("HasMasterPassword");

    const masterPasswordUnlock = this.getResponseProperty("MasterPasswordUnlock");
    if (masterPasswordUnlock != null && typeof masterPasswordUnlock === "object") {
      this.masterPasswordUnlock = new MasterPasswordUnlockResponse(masterPasswordUnlock);
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
    if (response.WebAuthnPrfOptions && Array.isArray(response.WebAuthnPrfOptions)) {
      this.webAuthnPrfOptions = this.getResponseProperty("WebAuthnPrfOptions")?.map(
        (option: IWebAuthnPrfDecryptionOptionServerResponse) =>
          new WebAuthnPrfDecryptionOptionResponse(option),
      );
    }
  }
}
