import { Cart } from "@bitwarden/pricing";

type HasCart = {
  cart: Cart;
};

type HasStorage = {
  storage: {
    available: number;
    readableUsed: string;
    used: number;
  };
};

type Suspension = {
  status: "incomplete" | "incomplete_expired" | "past_due" | "unpaid";
  suspension: Date;
  gracePeriod: number;
};

type Billable = {
  status: "trialing" | "active";
  nextCharge: Date;
  cancelAt?: Date;
};

type Canceled = {
  status: "canceled";
  canceled: Date;
};

export type BitwardenSubscription = HasCart & HasStorage & (Suspension | Billable | Canceled);
