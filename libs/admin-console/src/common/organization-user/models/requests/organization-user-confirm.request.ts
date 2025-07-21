import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class OrganizationUserConfirmRequest {
  key: EncryptedString | undefined;
  defaultUserCollectionName: EncryptedString | undefined;
}
