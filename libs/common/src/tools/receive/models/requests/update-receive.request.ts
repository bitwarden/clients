import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class UpdateReceiveRequest {
  name: string;
  expirationDate: string;

  constructor(name: EncString, expirationDate: Date) {
    if (name.encryptedString == null) {
      throw new Error("Invalid encrypted data for UpdateReceiveRequest");
    }

    this.name = name.encryptedString;
    this.expirationDate = expirationDate.toISOString();
  }
}
