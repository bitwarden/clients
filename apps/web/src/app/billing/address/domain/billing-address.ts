export type BillingAddress = {
  country: string;
  postalCode: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  taxId?: string;
};
