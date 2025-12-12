import { UnsignedSharedKey } from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";

export class WebauthnRotateCredentialRequest {
  id: string;
  encryptedPublicKey: EncString;
  encryptedUserKey: UnsignedSharedKey;

  constructor(id: string, encryptedPublicKey: EncString, encryptedUserKey: UnsignedSharedKey) {
    this.id = id;
    this.encryptedPublicKey = encryptedPublicKey;
    this.encryptedUserKey = encryptedUserKey;
  }
}
