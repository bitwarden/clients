import { Guid } from "../../../types/guid";
import { Cipher } from "../domain/cipher";

import { CipherRequest } from "./cipher.request";

export class CipherWithIdRequest extends CipherRequest {
  id: Guid;

  constructor(cipher: Cipher) {
    super(cipher);
    this.id = cipher.id;
  }
}
