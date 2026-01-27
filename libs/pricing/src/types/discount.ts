import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export const DiscountTypes = {
  AmountOff: "amount-off",
  PercentOff: "percent-off",
} as const;

export type DiscountType = (typeof DiscountTypes)[keyof typeof DiscountTypes];

/**
 * Represents a discount that can be applied to a price.
 * - type: The type of discount (amount-off or percent-off).
 * - value: The value of the discount. For amount-off, this is a fixed amount (e.g., 5 for $5 off).
 *          For percent-off, this is a percentage (e.g., 10 for 10% off).
 * - translationKey: An optional key for localization of the discount label.
 * - quantity: An optional quantity associated with the discount (e.g., number of items).
 * note: when quantity is provided, it is displayed in the label instead of the value.
 */
export type Discount = {
  type: DiscountType;
  value: number;
  translationKey?: string;
  quantity?: number;
};

export const getLabel = (i18nService: I18nService, discount: Discount): string => {
  const showQuantity = discount.quantity != null && discount.quantity > 0;
  switch (discount.type) {
    case DiscountTypes.AmountOff: {
      const formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(discount.value);
      return `${showQuantity ? discount.quantity : formattedAmount} ${i18nService.t(discount.translationKey ?? "discount")}`;
    }
    case DiscountTypes.PercentOff: {
      const percentValue = discount.value < 1 ? discount.value * 100 : discount.value;
      return `${Math.round(percentValue)}% ${i18nService.t(discount.translationKey ?? "discount")}`;
    }
  }
};
