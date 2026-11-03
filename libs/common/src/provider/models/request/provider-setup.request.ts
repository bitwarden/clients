export interface TokenizedPaymentMethod {
  type: "bankAccount" | "card" | "payPal";
  token: string;
}

export interface BillingAddress {
  country: string;
  postalCode: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  taxId: { code: string; value: string } | null;
}

export class ProviderSetupRequest {
  name: string;
  businessName?: string;
  billingEmail: string;
  token: string;
  key: string;
  paymentMethod: TokenizedPaymentMethod;
  billingAddress: BillingAddress;

  constructor(c: {
    name: string;
    businessName?: string;
    billingEmail: string;
    token: string;
    key: string;
    paymentMethod: TokenizedPaymentMethod;
    billingAddress: BillingAddress;
  }) {
    this.name = c.name;
    this.businessName = c.businessName;
    this.billingEmail = c.billingEmail;
    this.token = c.token;
    this.key = c.key;
    this.paymentMethod = c.paymentMethod;
    this.billingAddress = c.billingAddress;
  }
}
