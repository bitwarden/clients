export class OrganizationUserResetPasswordEntry {
  orgId: string;
  publicKey: Uint8Array;
  orgName: string;

  constructor(orgId: string, publicKey: Uint8Array, orgName: string) {
    this.orgId = orgId;
    this.publicKey = publicKey;
    this.orgName = orgName;
  }
}
