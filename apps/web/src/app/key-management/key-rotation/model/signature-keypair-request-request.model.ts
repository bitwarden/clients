import { SigningKey } from "@bitwarden/common/key-management/keys/models/signing-key";
import { VerifyingKey } from "@bitwarden/common/key-management/keys/models/verifying-key";
import { EncString, SignatureAlgorithm } from "@bitwarden/sdk-internal";

export class SignatureKeyPairRequestModel {
  signatureAlgorithm: SignatureAlgorithm;
  wrappedSigningKey: EncString;
  verifyingKey: string;

  constructor(
    signingKey: SigningKey,
    verifyingKey: VerifyingKey,
    signingKeyAlgorithm: SignatureAlgorithm,
  ) {
    this.signatureAlgorithm = signingKeyAlgorithm;
    this.wrappedSigningKey = signingKey.inner();
    this.verifyingKey = verifyingKey.toString();
  }
}
