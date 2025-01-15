// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { RotateableKeySet } from "../../../../../auth/src/common/models";
import { EncString } from "../../../platform/models/domain/enc-string";

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
