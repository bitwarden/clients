import { BitwardenIcon, ButtonType } from "@bitwarden/components";

export type SubscriptionPricingCardDetails = {
  title: string;
  tagline: string;
  price?: {
    amount: number;
    cadence: "month" | "monthly" | "year" | "annually";
    showPerUser?: boolean;
  };
  button: {
    text: string;
    type: ButtonType;
    icon?: { type: BitwardenIcon; position: "before" | "after" };
  };
  features: string[];
};
