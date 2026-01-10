import { EncryptionContext } from "../../abstractions/cipher.service";

import { CipherRequest } from "./cipher.request";

export class CipherWithIdRequest extends CipherRequest {
  id: string;

  constructor({ cipher, encryptedFor }: EncryptionContext) {
    super({ cipher, encryptedFor });
    this.id = cipher.id;
  }
}
