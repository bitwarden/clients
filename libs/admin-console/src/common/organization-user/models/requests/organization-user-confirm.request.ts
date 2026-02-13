import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { UnsignedSharedKey } from "@bitwarden/sdk-internal";

export class OrganizationUserConfirmRequest {
  key: UnsignedSharedKey | undefined;
  defaultUserCollectionName: EncryptedString | undefined;
}
