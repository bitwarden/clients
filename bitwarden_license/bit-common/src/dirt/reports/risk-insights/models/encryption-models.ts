import { OrganizationId } from "@bitwarden/common/types/guid";
import { EncString } from "@bitwarden/sdk-internal";

// -------------------- Encryption Models --------------------
/*
 * After data is encrypted, it is returned with the
 * encryption key used to encrypt the data.
 */
export interface EncryptedDataWithKey {
  organizationId: OrganizationId;
  encryptedData: EncString;
  encryptionKey: EncString;
}

export interface EncryptedDataModel {
  organizationId: OrganizationId;
  encryptedData: string;
  encryptionKey: string;
  date: Date;
}
