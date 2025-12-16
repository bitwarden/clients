import { Discount, LineItem } from "@bitwarden/pricing";

import { BitwardenSubscriber } from "./bitwarden-subscriber";

type Cart = {
  passwordManager: LineItem;
  additionalStorage?: LineItem;
  secretsManager?: { seats: LineItem; additionalServiceAccounts?: LineItem };
  discount?: Discount;
  estimatedTax: number;
};

type Incomplete = {
  status: "incomplete";
  created: Date;
};

type IncompleteExpired = {
  status: "incomplete_expired";
  created: Date;
};

type Trialing = {
  status: "trialing";
  nextCharge: Date;
  cancelAt?: Date;
};

type Active = {
  status: "active";
  nextCharge: Date;
  cancelAt?: Date;
};

type PastDue = {
  status: "past_due";
  expired: Date;
  suspension: Date;
  gracePeriod: number;
  cancelAt?: Date;
};

type Canceled = {
  status: "canceled";
  canceled: Date;
};

type Unpaid = {
  status: "unpaid";
  suspension: Date;
};

export type BitwardenSubscription = {
  subscriber: BitwardenSubscriber;
  cart: Cart;
} & (Incomplete | IncompleteExpired | Trialing | Active | PastDue | Canceled | Unpaid);
