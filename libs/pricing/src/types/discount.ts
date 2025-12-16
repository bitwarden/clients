import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

type AmountOff = {
  _tag: "amount-off";
  // The value of the amount-off discount.
  value: number;
};

type PercentOff = {
  _tag: "percent-off";
  // The value of the percent-off discount.
  value: number;
};

/**
 * A type representing a discount that can be displayed via a discount badge.
 * */
export type Discount = {
  // Whether the discount is active.
  active: boolean;
} & (AmountOff | PercentOff);

export const getDiscountText = (i18nService: I18nService, discount: Discount): string => {
  switch (discount._tag) {
    case "amount-off": {
      const formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(discount.value);
      return `${formattedAmount} ${i18nService.t("discount")}`;
    }
    case "percent-off": {
      const percentValue = discount.value < 1 ? discount.value * 100 : discount.value;
      return `${Math.round(percentValue)}% ${i18nService.t("discount")}`;
    }
  }
};
