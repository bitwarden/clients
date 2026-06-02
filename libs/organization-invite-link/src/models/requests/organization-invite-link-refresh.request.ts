export class OrganizationInviteLinkRefreshRequest {
  encryptedInviteKey: string;
  encryptedOrgKey: string | undefined;

  constructor(c: { encryptedInviteKey: string; encryptedOrgKey?: string | undefined }) {
    if (!c.encryptedInviteKey) {
      throw new Error("EncryptedInviteKey is required.");
    }
    this.encryptedInviteKey = c.encryptedInviteKey;
    this.encryptedOrgKey = c.encryptedOrgKey ?? undefined;
  }
}
