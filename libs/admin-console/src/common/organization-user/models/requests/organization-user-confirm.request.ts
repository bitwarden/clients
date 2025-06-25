import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";

export class OrganizationUserConfirmRequest {
  key: EncryptedString | undefined;
  defaultUserCollectionName: EncryptedString | undefined;
}
