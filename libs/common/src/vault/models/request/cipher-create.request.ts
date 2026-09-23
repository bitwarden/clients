import { EncryptionContext } from "../../abstractions/cipher.service";

import { CipherRequest } from "./cipher.request";

export class CipherCreateRequest {
  cipher: CipherRequest;
  collectionIds: string[];

  constructor(context: EncryptionContext) {
    this.cipher = new CipherRequest(context);
    this.collectionIds = context.cipher.collectionIds;
  }
}
