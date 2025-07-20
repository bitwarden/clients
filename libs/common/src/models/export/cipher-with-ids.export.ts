// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Cipher as CipherDomain } from "../../vault/models/domain/cipher";
import { CipherView } from "../../vault/models/view/cipher.view";

import { CipherExport } from "./cipher.export";

export class CipherWithIdExport extends CipherExport {
  id: string;
  collectionIds: string[];

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CipherView | CipherDomain) {
    this.id = o.id;
    super.build(o);
    this.collectionIds = o.collectionIds;
  }
}
