import { SignedPublicKey } from "../../types";
import { VerifyingKey } from "../models/verifying-key";


export class PublicAccountKeysResponseModel {
  readonly VerifyingKey: VerifyingKey;
  readonly PublicKey: string;
  readonly SignedPublicKeyOwnershipClaim: SignedPublicKey;

  constructor(response: any) {
    this.VerifyingKey = new VerifyingKey(response.verifyingKey);
    this.PublicKey = response.publicKey;
    this.SignedPublicKeyOwnershipClaim = response.signedPublicKeyOwnershipClaim;
  }
}
