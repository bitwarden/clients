import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class OrganizationInviteLinkCreateRequest {
  allowedDomains: string[];
  encryptedInviteKey: string;
  encryptedOrgKey: string | null;

  constructor(c: {
    allowedDomains: string[];
    encryptedInviteKey: EncString;
    encryptedOrgKey?: EncString | null;
  }) {
    if (!c.allowedDomains || c.allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }
    if (!c.encryptedInviteKey?.encryptedString) {
      throw new Error("EncryptedInviteKey is required.");
    }

    this.allowedDomains = c.allowedDomains;
    this.encryptedInviteKey = c.encryptedInviteKey.encryptedString;
    this.encryptedOrgKey = c.encryptedOrgKey?.encryptedString ?? null;
  }
}
