import { Cart } from "@bitwarden/pricing";

import { Storage } from "./storage";

type HasCart = {
  cart: Cart;
};

type HasStorage = {
  storage: Storage;
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
