import { EncryptionContext } from "../../abstractions/cipher.service";

import { CipherRequest } from "./cipher.request";

export class CipherWithIdRequest extends CipherRequest {
  id: string;

  constructor(context: EncryptionContext) {
    super(context);
    this.id = context.cipher.id;
  }
}
