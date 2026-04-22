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
 * Calculates the total compounded percent-off from multiple active discounts.
 * For example, a 10% discount stacked with a 20% discount yields 28% (not 30%).
 * Returns an integer in the range [0, 100].
 *
 * Only considers `percentOff` discounts. Amount-off discounts cannot be meaningfully
 * represented as a percentage without knowing the base amount, so they are handled
 * separately in per-line-item calculations (e.g., `calculateIndividualDiscounts`).
 */
export const getCompoundedPercentOff = (
  discounts: { active: boolean; percentOff?: number }[],
): number => {
  let multiplier = 1;
  for (const d of discounts) {
    if (d.active && d.percentOff) {
      multiplier *= 1 - d.percentOff / 100;
    }
  }
  return Math.round((1 - multiplier) * 100);
};

/**
 * Converts an array of billing customer discounts into displayable {@link Discount} objects.
 *
 * Filters to only active discounts with a non-zero percentOff or amountOff value.
 * Optionally excludes discounts whose id is in the provided `excludeIds` set
 * (e.g., "sm-standalone" coupons that shouldn't display as discount badges).
 */
export const toDisplayableDiscounts = (
  customerDiscounts: { id?: string; active: boolean; percentOff?: number; amountOff?: number }[],
  excludeIds?: Set<string>,
): Discount[] => {
  return customerDiscounts
    .filter(
      (d) =>
        d.active &&
        ((d.percentOff ?? 0) > 0 || (d.amountOff ?? 0) > 0) &&
        (!excludeIds || !d.id || !excludeIds.has(d.id)),
    )
    .map(
      (d): Discount =>
        d.amountOff
          ? { type: DiscountTypes.AmountOff, value: d.amountOff }
          : { type: DiscountTypes.PercentOff, value: d.percentOff ?? 0 },
    );
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
