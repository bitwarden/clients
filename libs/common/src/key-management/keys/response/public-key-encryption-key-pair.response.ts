import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import { SignedPublicKey } from "../../types";

export class PublicKeyEncryptionKeyPairResponse {
  readonly publicKey: Uint8Array;
  readonly wrappedPrivateKey: EncString;
  readonly signedPublicKey: SignedPublicKey;

  constructor(response: any) {
    this.publicKey = Utils.fromB64ToArray(response.publicKey);
    this.wrappedPrivateKey = new EncString(response.wrappedPrivateKey);
    this.signedPublicKey = response.signedPublicKey;
  }
}
