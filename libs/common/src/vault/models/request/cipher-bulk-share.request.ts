// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { UserId } from "../../../types/guid";
import { Cipher } from "../domain/cipher";

import { CipherWithIdRequest } from "./cipher-with-id.request";

export class CipherBulkShareRequest {
  ciphers: CipherWithIdRequest[];
  collectionIds: string[];

  constructor(
    ciphers: Cipher[],
    collectionIds: string[],
    readonly encryptedFor: UserId,
  ) {
    if (ciphers != null) {
      this.ciphers = [];
      ciphers.forEach((c) => {
        this.ciphers.push(new CipherWithIdRequest({ cipher: c, encryptedFor }));
      });
    }
    this.collectionIds = collectionIds;
  }
}
