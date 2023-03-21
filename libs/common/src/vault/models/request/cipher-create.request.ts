import { Guid } from "../../../types/guid";
import { Cipher } from "../domain/cipher";

import { CipherRequest } from "./cipher.request";

export class CipherCreateRequest {
  cipher: CipherRequest;
  collectionIds: Guid[];

  constructor(cipher: Cipher) {
    this.cipher = new CipherRequest(cipher);
    this.collectionIds = cipher.collectionIds;
  }
}
