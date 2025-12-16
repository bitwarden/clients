import { Opaque } from "type-fest";

import { UserId } from "@bitwarden/user-core";

import { OrganizationSubscriptionTier } from "./organization-subscription-tier";

export type Maybe<T> = T | null | undefined;

interface Account {
  id: UserId;
  email: string;
}

interface Organization {
  id: Opaque<string, "OrganizationId">;
  name: string;
  tier: OrganizationSubscriptionTier;
}

interface Provider {
  id: string;
  name: string;
}

export type BitwardenSubscriber =
  | { type: "account"; data: Account }
  | { type: "organization"; data: Organization }
  | { type: "provider"; data: Provider };

export type NonIndividualBitwardenSubscriber = Exclude<BitwardenSubscriber, { type: "account" }>;
