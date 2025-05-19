import { UserId } from "../../../types/guid";
import { Cipher } from "../domain/cipher";

import { CipherRequest } from "./cipher.request";

export class CipherWithIdRequest extends CipherRequest {
  id: string;

  constructor({ cipher, encryptedFor }: { cipher: Cipher; encryptedFor: UserId }) {
    super({ cipher, encryptedFor });
    this.id = cipher.id;
  }
}
