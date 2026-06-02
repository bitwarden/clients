export class OrganizationInviteLinkCreateRequest {
  allowedDomains: string[];
  encryptedInviteKey: string;
  encryptedOrgKey: string | undefined;

  constructor(c: {
    allowedDomains: string[];
    encryptedInviteKey: string;
    encryptedOrgKey?: string | undefined;
  }) {
    if (!c.allowedDomains || c.allowedDomains.length === 0) {
      throw new Error("At least one allowed domain is required.");
    }
    if (!c.encryptedInviteKey) {
      throw new Error("EncryptedInviteKey is required.");
    }

    this.allowedDomains = c.allowedDomains;
    this.encryptedInviteKey = c.encryptedInviteKey;
    this.encryptedOrgKey = c.encryptedOrgKey ?? undefined;
  }
}
