import { Discount } from "@bitwarden/pricing";

import { Credit } from "./credit";

export type CartItem = {
  translationKey: string;
  translationParams?: Array<string | number>;
  quantity: number;
  cost: number;
  discount?: Discount;
  hideBreakdown?: boolean;
};

export type Cart = {
  passwordManager: {
    seats: CartItem;
    additionalStorage?: CartItem;
  };
  secretsManager?: {
    seats: CartItem;
    additionalServiceAccounts?: CartItem;
  };
  cadence: "annually" | "monthly";
  discount?: Discount;
  credit?: Credit;
  estimatedTax: number;
};
