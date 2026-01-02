import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export type Discount = {
  type: "amount-off" | "percent-off";
  active: boolean;
  value: number;
};

export const getLabel = (i18nService: I18nService, discount: Discount): string => {
  switch (discount.type) {
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
