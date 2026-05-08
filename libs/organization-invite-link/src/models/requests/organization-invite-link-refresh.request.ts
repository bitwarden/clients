import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class OrganizationInviteLinkRefreshRequest {
  encryptedInviteKey: string;
  encryptedOrgKey: string | null;

  constructor(c: { encryptedInviteKey: EncString; encryptedOrgKey?: EncString | null }) {
    if (!c.encryptedInviteKey?.encryptedString) {
      throw new Error("EncryptedInviteKey is required.");
    }
    this.encryptedInviteKey = c.encryptedInviteKey.encryptedString;
    this.encryptedOrgKey = c.encryptedOrgKey?.encryptedString ?? null;
  }
}
