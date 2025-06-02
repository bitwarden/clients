import { SigningKey } from "../models/signing-key";
import { VerifyingKey } from "../models/verifying-key";

export class UserSigningKeyData {
  readonly wrappedSigningKey: SigningKey;
  readonly verifyingKey: VerifyingKey;

  constructor(response: any) {
    this.wrappedSigningKey = new SigningKey(response.wrappedSigningKey);
    this.verifyingKey = new VerifyingKey(response.verifyingKey);
  }
}
