import { UserId } from "../../../types/guid";
import { Cipher } from "../domain/cipher";

import { CipherRequest } from "./cipher.request";

export class CipherCreateRequest {
  cipher: CipherRequest;
  collectionIds: string[];

  constructor({ cipher, encryptedFor }: { cipher: Cipher; encryptedFor: UserId }) {
    this.cipher = new CipherRequest({ cipher, encryptedFor });
    this.collectionIds = cipher.collectionIds;
  }
}
