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
    seats?: CartItem;
    additionalStorage?: CartItem;
    /** Each proration charge rendered as its own line row, labeled by its purchasable reference. */
    prorationCharges?: CartItem[];
  };
  secretsManager?: {
    seats?: CartItem;
    additionalServiceAccounts?: CartItem;
    prorationCharges?: CartItem[];
  };
  cadence: "annually" | "monthly";
  discounts?: CartDiscount[];
  credit?: Credit;
  estimatedTax: number;
  /**
   * The authoritative invoice total, set by the preview adapter. Absent on legacy carts, in
   * which case the renderer falls back to computing the total from the cart's line items.
   */
  total?: number;
};
