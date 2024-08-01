import { SSHKeyApi } from "../api/ssh-key.api";

export class SSHKeyData {
  privateKey: string;
  publicKey: string;
  keyAlgorithm: string;

  constructor(data?: SSHKeyApi) {
    if (data == null) {
      return;
    }

    this.privateKey = data.privateKey;
    this.publicKey = data.publicKey;
    this.keyAlgorithm = data.keyAlgorithm;
  }
}
