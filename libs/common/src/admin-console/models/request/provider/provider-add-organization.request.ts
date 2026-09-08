export class ProviderAddOrganizationRequest {
  organizationId: string;
  key: string;

  constructor(c: { organizationId: string; key: string }) {
    this.organizationId = c.organizationId;
    this.key = c.key;
  }
}
