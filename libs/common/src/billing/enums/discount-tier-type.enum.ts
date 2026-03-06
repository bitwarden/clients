export const DiscountTierType = {
  Premium: "Premium",
  Families: "Families",
} as const;

export type DiscountTierType = (typeof DiscountTierType)[keyof typeof DiscountTierType];
