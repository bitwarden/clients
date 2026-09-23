// eslint-disable-next-line no-restricted-imports
import { VerifyingKey, WrappedSigningKey } from "@bitwarden/legacy-crypto";
import { SignatureAlgorithm } from "@bitwarden/sdk-internal";

export class SignatureKeyPairRequestModel {
  signatureAlgorithm: SignatureAlgorithm;
  wrappedSigningKey: WrappedSigningKey;
  verifyingKey: VerifyingKey;

  constructor(
    signingKey: WrappedSigningKey,
    verifyingKey: VerifyingKey,
    signingKeyAlgorithm: SignatureAlgorithm,
  ) {
    this.signatureAlgorithm = signingKeyAlgorithm;
    this.wrappedSigningKey = signingKey;
    this.verifyingKey = verifyingKey;
  }
}
