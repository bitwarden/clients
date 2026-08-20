export const DiscountTierType = Object.freeze({
  Premium: "Premium",
  Families: "Families",
} as const);

export type DiscountTierType = (typeof DiscountTierType)[keyof typeof DiscountTierType];
