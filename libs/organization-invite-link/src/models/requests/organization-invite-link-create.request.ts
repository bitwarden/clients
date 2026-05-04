import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class OrganizationInviteLinkCreateRequest {
  allowedDomains: string[];
  encryptedInviteKey: string;
  encryptedOrgKey: string | null;

  constructor(
    allowedDomains: string[],
    encryptedInviteKey: EncString,
    encryptedOrgKey?: EncString | null,
  ) {
    if (!allowedDomains || allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }
    if (!encryptedInviteKey?.encryptedString) {
      throw new Error("EncryptedInviteKey is required.");
    }

    this.allowedDomains = allowedDomains;
    this.encryptedInviteKey = encryptedInviteKey.encryptedString;
    this.encryptedOrgKey = encryptedOrgKey?.encryptedString ?? null;
  }
}
