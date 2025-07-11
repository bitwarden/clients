import { WrappedSigningKey } from "../models/signing-key";
import { VerifyingKey } from "../models/verifying-key";

export class SignatureKeyPairResponse {
  readonly wrappedSigningKey: WrappedSigningKey;
  readonly verifyingKey: VerifyingKey;

  constructor(response: any) {
    this.wrappedSigningKey = new WrappedSigningKey(response.wrappedSigningKey);
    this.verifyingKey = new VerifyingKey(response.verifyingKey);
  }
}
