// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class BitPayInvoiceRequest {
  userId: string;
  organizationId: string;
  providerId: string;
  credit: boolean;
  amount: number;
  returnUrl: string;
  name: string;
  email: string;
}
