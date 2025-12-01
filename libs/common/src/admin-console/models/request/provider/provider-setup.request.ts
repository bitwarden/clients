// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
interface TokenizedPaymentMethod {
  type: "bankAccount" | "card" | "payPal";
  token: string;
}

interface BillingAddress {
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
  businessName: string;
  billingEmail: string;
  token: string;
  key: string;
  paymentMethod: TokenizedPaymentMethod;
  billingAddress: BillingAddress;
}
