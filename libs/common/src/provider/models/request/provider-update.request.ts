export class ProviderUpdateRequest {
  name: string;
  businessName: string;
  billingEmail: string;

  constructor(c: { name: string; businessName: string; billingEmail: string }) {
    this.name = c.name;
    this.businessName = c.businessName;
    this.billingEmail = c.billingEmail;
  }
}
