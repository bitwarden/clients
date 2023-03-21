import { Guid } from "../../../types/guid";
import { Cipher } from "../domain/cipher";

export class CipherPartialRequest {
  folderId: Guid;
  favorite: boolean;

  constructor(cipher: Cipher) {
    this.folderId = cipher.folderId;
    this.favorite = cipher.favorite;
  }
}
