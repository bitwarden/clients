import { SubscriptionCadence } from "@bitwarden/common/billing/types/subscription-pricing-tier";
import { BitwardenIcon, ButtonType } from "@bitwarden/components";

export type SubscriptionPricingCardDetails = {
  title: string;
  tagline: string;
  price?: { amount: number; cadence: SubscriptionCadence };
  button: {
    text: string;
    type: ButtonType;
    icon?: { type: BitwardenIcon; position: "before" | "after" };
  };
  features: string[];
};
