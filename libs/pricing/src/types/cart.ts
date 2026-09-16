import { Credit } from "./credit";
import { CartDiscount } from "./discount";

export type CartItem = {
  translationKey: string;
  translationParams?: Array<string | number>;
  quantity: number;
  cost: number;
  discounts?: CartDiscount[];
  hideBreakdown?: boolean;
};

export type Cart = {
  passwordManager: {
    seats: CartItem;
    additionalStorage?: CartItem;
  };
  secretsManager?: {
    seats?: CartItem;
    additionalServiceAccounts?: CartItem;
  };
  cadence: "annually" | "monthly";
  discounts?: CartDiscount[];
  credit?: Credit;
  estimatedTax: number;
  /**
   * The invoice's `amountDue`, set by the preview adapter. Absent on legacy carts, where the
   * renderer computes the total from the line items instead.
   */
  total?: number;
};
