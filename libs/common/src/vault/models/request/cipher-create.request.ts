import { EncryptionContext } from "../../abstractions/cipher.service";

import { CipherRequest } from "./cipher.request";

export class CipherCreateRequest {
  cipher: CipherRequest;
  collectionIds: string[];

  constructor({ cipher, encryptedFor }: EncryptionContext) {
    this.cipher = new CipherRequest({ cipher, encryptedFor });
    this.collectionIds = cipher.collectionIds;
  }
}
