import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class CreateReceiveRequest {
  name: string;
  scekWrappedPublicKey: string;
  userKeyWrappedSharedContentEncryptionKey: string;
  userKeyWrappedPrivateKey: string;
  expirationDate: string;

  constructor(
    name: EncString,
    scekWrappedPublicKey: EncString,
    userKeyWrappedSharedContentEncryptionKey: EncString,
    userKeyWrappedPrivateKey: EncString,
    expirationDate: Date,
  ) {
    if (
      name.encryptedString == null ||
      scekWrappedPublicKey.encryptedString == null ||
      userKeyWrappedSharedContentEncryptionKey.encryptedString == null ||
      userKeyWrappedPrivateKey.encryptedString == null
    ) {
      throw new Error("Invalid encrypted data for CreateReceiveRequest");
    }

    this.name = name.encryptedString;
    this.scekWrappedPublicKey = scekWrappedPublicKey.encryptedString;
    this.userKeyWrappedSharedContentEncryptionKey =
      userKeyWrappedSharedContentEncryptionKey.encryptedString;
    this.userKeyWrappedPrivateKey = userKeyWrappedPrivateKey.encryptedString;
    this.expirationDate = expirationDate.toISOString();
  }
}
