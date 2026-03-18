import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export const DiscountTypes = {
  AmountOff: "amount-off",
  PercentOff: "percent-off",
} as const;

export type DiscountType = (typeof DiscountTypes)[keyof typeof DiscountTypes];

export type Discount = {
  type: DiscountType;
  value: number;
};

/**
 * Calculates the discount amount in currency.
 *
 * For `PercentOff`, values < 1 are treated as decimal multipliers (e.g., 0.25 = 25%),
 * while values >= 1 are treated as whole-number percentages (e.g., 25 = 25%).
 * This convention matches the server's discount model.
 */
export const getAmount = (discount: Discount, baseAmount: number): number => {
  switch (discount.type) {
    case DiscountTypes.PercentOff: {
      const percentage = discount.value < 1 ? discount.value : discount.value / 100;
      return baseAmount * percentage;
    }
    case DiscountTypes.AmountOff:
      return discount.value;
    default: {
      const _exhaustive: never = discount.type;
      throw new Error(`Unhandled discount type: ${_exhaustive}`);
    }
  }
};

export const getLabel = (i18nService: I18nService, discount: Discount): string => {
  switch (discount.type) {
    case DiscountTypes.AmountOff: {
      const formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(discount.value);
      return `${formattedAmount} ${i18nService.t("discount")}`;
    }
    case DiscountTypes.PercentOff: {
      const percentValue = discount.value < 1 ? discount.value * 100 : discount.value;
      return `${Math.round(percentValue)}% ${i18nService.t("discount")}`;
    }
  }
};
