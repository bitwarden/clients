import { Guid } from "../../types/guid";

export class BitPayInvoiceRequest {
  userId: Guid;
  organizationId: Guid;
  credit: boolean;
  amount: number;
  returnUrl: string;
  name: string;
  email: string;
}
