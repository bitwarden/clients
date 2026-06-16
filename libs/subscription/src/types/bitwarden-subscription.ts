import { Cart } from "@bitwarden/pricing";

import { Storage } from "./storage";

export const SubscriptionStatuses = {
  Incomplete: "incomplete",
  IncompleteExpired: "incomplete_expired",
  Trialing: "trialing",
  Active: "active",
  PastDue: "past_due",
  Canceled: "canceled",
  Unpaid: "unpaid",
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatuses)[keyof typeof SubscriptionStatuses];

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
