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
 * The discount shape the cart renderer consumes — the structural union of what its two
 * producers supply.
 *
 * Legacy flag-OFF carts carry plain {@link Discount}s, so the renderer derives `amount` and
 * `label` via {@link getAmount} / {@link getLabel}. Preview-driven carts carry
 * `InvoicePreviewDiscount`s, whose required `amount` (the server's authoritative applied amount
 * in dollars) and `label` (the coupon name) take precedence over derivation. Both types are
 * assignable to this one.
 */
export type CartDiscount = {
  type: DiscountType;
  value: number;
  amount?: number;
  label?: string;
  /** Number of months the coupon repeats for; absent for perpetual or once-only coupons. */
  durationInMonths?: number;
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
 * {@link CartDiscount.label} (the coupon name) when present and otherwise deriving
 * one from the discount's type and value. A repeating coupon's `durationInMonths` is
 * appended as a qualifier, mirroring the legacy subscription page.
 */
export const getLabel = (i18nService: I18nService, discount: CartDiscount): string => {
  let label: string;
  if (discount.label) {
    label = discount.label;
  } else {
    switch (discount.type) {
      case DiscountTypes.AmountOff: {
        const formattedAmount = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(discount.value);
        label = `${formattedAmount} ${i18nService.t("discount")}`;
        break;
      }
      case DiscountTypes.PercentOff: {
        const percentValue = discount.value < 1 ? discount.value * 100 : discount.value;
        label = `${Math.round(percentValue)}% ${i18nService.t("discount")}`;
        break;
      }
    }
  }

  if (discount.durationInMonths == null) {
    return label;
  }
  const duration =
    discount.durationInMonths === 12
      ? i18nService.t("discountForOneYear")
      : i18nService.t("discountForMonths", discount.durationInMonths.toString());
  return `${label} ${duration}`;
};
