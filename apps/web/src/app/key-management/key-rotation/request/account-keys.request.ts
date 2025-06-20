import { SigningKey } from "@bitwarden/common/key-management/keys/models/signing-key";
import { VerifyingKey } from "@bitwarden/common/key-management/keys/models/verifying-key";
import { SignedPublicKey } from "@bitwarden/common/key-management/types";
import { EncString, SignatureAlgorithm } from "@bitwarden/sdk-internal";

import { PublicKeyEncryptionKeyPairRequestModel } from "../model/public-key-encryption-keypair-request.model";
import { SignatureKeyPairRequestModel } from "../model/signature-keypair-request-request.model";

// This request contains other account-owned keys that are encrypted with the user key.
export class AccountKeysRequest {
  /**
   * @deprecated
   */
  userKeyEncryptedAccountPrivateKey: string;
  /**
   * @deprecated
   */
  accountPublicKey: string;

  publicKeyEncryptionKeyPair: PublicKeyEncryptionKeyPairRequestModel | null;
  signatureKeyPair: SignatureKeyPairRequestModel | null;

  constructor(
    wrappedPrivateKey: EncString,
    publicKey: string,
    signedPublicKey: SignedPublicKey | null,
    wrappedSigningKey: SigningKey | null,
    verifyingKey: VerifyingKey | null,
    signatureAlgorithm: SignatureAlgorithm | null = null,
  ) {
    this.userKeyEncryptedAccountPrivateKey = wrappedPrivateKey;
    this.accountPublicKey = publicKey;
    this.publicKeyEncryptionKeyPair = new PublicKeyEncryptionKeyPairRequestModel(
      wrappedPrivateKey,
      publicKey,
      signedPublicKey,
    );

    if (wrappedSigningKey && verifyingKey && signatureAlgorithm) {
      this.signatureKeyPair = new SignatureKeyPairRequestModel(
        wrappedSigningKey,
        verifyingKey,
        signatureAlgorithm,
      );
    }
  }
}
