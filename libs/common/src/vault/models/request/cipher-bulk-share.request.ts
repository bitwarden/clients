import { Guid } from "../../../types/guid";
import { Cipher } from "../domain/cipher";

import { CipherWithIdRequest } from "./cipher-with-id.request";

export class CipherBulkShareRequest {
  ciphers: CipherWithIdRequest[];
  collectionIds: Guid[];

  constructor(ciphers: Cipher[], collectionIds: Guid[]) {
    if (ciphers != null) {
      this.ciphers = [];
      ciphers.forEach((c) => {
        this.ciphers.push(new CipherWithIdRequest(c));
      });
    }
    this.collectionIds = collectionIds;
  }
}
