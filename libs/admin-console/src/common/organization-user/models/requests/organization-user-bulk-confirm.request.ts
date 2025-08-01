import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";

type OrganizationUserBulkRequestEntry = {
  id: string;
  key: string;
};

export class OrganizationUserBulkConfirmRequest {
  keys: OrganizationUserBulkRequestEntry[];
  defaultUserCollectionName: EncryptedString | undefined;

  constructor(
    keys: OrganizationUserBulkRequestEntry[],
    defaultUserCollectionName?: EncryptedString,
  ) {
    this.keys = keys;
    this.defaultUserCollectionName = defaultUserCollectionName;
  }
}
