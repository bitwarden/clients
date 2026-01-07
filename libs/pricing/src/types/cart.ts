import { Discount } from "@bitwarden/pricing";

export type CartItem = {
  name: string;
  quantity: number;
  cost: number;
  discount?: Discount;
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
  estimatedTax: number;
};
