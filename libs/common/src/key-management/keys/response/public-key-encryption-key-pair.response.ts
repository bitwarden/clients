import { Utils } from "@bitwarden/common/platform/misc/utils";

import { SignedPublicKey, UnsignedPublicKey, WrappedPrivateKey } from "../../types";

export class PublicKeyEncryptionKeyPairResponse {
  readonly wrappedPrivateKey: WrappedPrivateKey;
  readonly publicKey: UnsignedPublicKey;

  readonly signedPublicKey: SignedPublicKey | null = null;

  constructor(response: unknown) {
    if (typeof response !== "object" || response == null) {
      throw new TypeError("Response must be an object");
    }

    if (!("publicKey" in response) || typeof response.publicKey !== "string") {
      throw new TypeError("Response must contain a valid publicKey");
    }
    this.publicKey = Utils.fromB64ToArray(response.publicKey) as UnsignedPublicKey;

    if (!("wrappedPrivateKey" in response) || typeof response.wrappedPrivateKey !== "string") {
      throw new TypeError("Response must contain a valid wrappedPrivateKey");
    }
    this.wrappedPrivateKey = response.wrappedPrivateKey as WrappedPrivateKey;

    if ("signedPublicKey" in response && typeof response.signedPublicKey === "string") {
      this.signedPublicKey = response.signedPublicKey as SignedPublicKey;
    } else {
      this.signedPublicKey = null;
    }
  }
}
