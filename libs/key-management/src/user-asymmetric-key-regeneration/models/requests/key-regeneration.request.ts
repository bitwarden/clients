import { EncString } from "../../../cryptography/domain/enc-string";

export class KeyRegenerationRequest {
  userPublicKey: string;
  userKeyEncryptedUserPrivateKey: EncString;

  constructor(userPublicKey: string, userKeyEncryptedUserPrivateKey: EncString) {
    this.userPublicKey = userPublicKey;
    this.userKeyEncryptedUserPrivateKey = userKeyEncryptedUserPrivateKey;
  }
}
