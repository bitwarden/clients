// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { RotateableKeySet } from "../../../key-management/keys/models/rotateable-key-set";

export class WebauthnRotateCredentialRequest {
  id: string;
  encryptedPublicKey: EncString;
  encryptedUserKey: EncString;

  constructor(id: string, encryptedPublicKey: EncString, encryptedUserKey: EncString) {
    this.id = id;
    this.encryptedPublicKey = encryptedPublicKey;
    this.encryptedUserKey = encryptedUserKey;
  }

  static fromRotateableKeyset(
    id: string,
    keyset: RotateableKeySet,
  ): WebauthnRotateCredentialRequest {
    return new WebauthnRotateCredentialRequest(
      id,
      keyset.encryptedPublicKey,
      keyset.encryptedPrivateKey,
    );
  }
}
