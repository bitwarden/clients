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
  hidePricingTerm?: boolean;
  discounts?: CartDiscount[];
  credit?: Credit;
  estimatedTax: number;
  /** The applied account balance as a positive magnitude; absent when none. Rendered as a
   * negative "Applied balance" row. */
  appliedBalance?: number;
  /** What the subscriber is charged after applied balance. Absent on legacy carts; the
   * renderer falls back to {@link total}. */
  amountDue?: number;
  /** The gross invoice total. Absent on legacy carts, where the renderer computes it from the
   * line items instead. */
  total?: number;
};
