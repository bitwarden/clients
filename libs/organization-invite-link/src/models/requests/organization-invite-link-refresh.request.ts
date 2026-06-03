import { InviteKeyEnvelope } from "@bitwarden/sdk-internal";

export class OrganizationInviteLinkRefreshRequest {
  encryptedInviteKey: InviteKeyEnvelope;
  encryptedOrgKey: string | undefined;

  constructor(c: { encryptedInviteKey: InviteKeyEnvelope; encryptedOrgKey?: string | undefined }) {
    if (!c.encryptedInviteKey) {
      throw new Error("EncryptedInviteKey is required.");
    }
    this.encryptedInviteKey = c.encryptedInviteKey;
    this.encryptedOrgKey = c.encryptedOrgKey ?? undefined;
  }
}
