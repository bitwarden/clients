import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export const DiscountTypes = {
  AmountOff: "amount-off",
  PercentOff: "percent-off",
} as const;

export type DiscountType = (typeof DiscountTypes)[keyof typeof DiscountTypes];

export type Discount = {
  type: DiscountType;
  value: number;
  /**
   * The authoritative applied amount in dollars, supplied by the server (cents / 100).
   * When present, renderers prefer this over deriving the amount via {@link getAmount}.
   */
  amount?: number;
  /**
   * The server-supplied coupon name. When present, {@link getLabel} returns it instead of
   * deriving a label from `type` and `value`.
   */
  label?: string;
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
      return Math.round(baseAmount * percentage * 100) / 100;
    }
    case DiscountTypes.AmountOff:
      return discount.value;
    default: {
      const _exhaustive: never = discount.type;
      throw new Error(`Unhandled discount type: ${_exhaustive}`);
    }
  }
};

/**
 * Resolves the display label for a discount, preferring the server-supplied
 * {@link Discount.label} (the coupon name) when present and otherwise deriving
 * one from the discount's type and value.
 */
export const getLabel = (i18nService: I18nService, discount: Discount): string => {
  if (discount.label) {
    return discount.label;
  }

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
