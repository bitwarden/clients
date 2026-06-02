import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export class OrganizationInviteLinkRefreshRequest {
  encryptedInviteKey: EncString;
  encryptedOrgKey: EncString | undefined;

  constructor(c: { encryptedInviteKey: EncString; encryptedOrgKey?: EncString | undefined }) {
    if (!c.encryptedInviteKey) {
      throw new Error("EncryptedInviteKey is required.");
    }
    this.encryptedInviteKey = c.encryptedInviteKey;
    this.encryptedOrgKey = c.encryptedOrgKey ?? undefined;
  }
}
