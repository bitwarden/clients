import type { Discount, DiscountType } from "@bitwarden/pricing";

import { BaseResponse } from "../../../models/response/base.response";

// Compared as literals rather than via the `DiscountTypes` const object: a value import would load
// the `@bitwarden/pricing` barrel — and its Angular components — at runtime, which libs/common
// (consumed by the non-Angular CLI) must not do. The literals are checked against `DiscountType`
// below, so drift from the union is still a compile error.
const AmountOff: DiscountType = "amount-off";
const PercentOff: DiscountType = "percent-off";

export class DiscountResponse extends BaseResponse implements Discount {
  type: DiscountType;
  value: number;
  amount?: number;
  label?: string;

  constructor(response: any) {
    super(response);

    const type = this.getResponseProperty("Type");
    if (type !== AmountOff && type !== PercentOff) {
      throw new Error(`Failed to parse invalid discount type: ${type}`);
    }
    this.type = type;
    this.value = this.getResponseProperty("Value");

    const amount = this.getResponseProperty("Amount");
    if (amount != null) {
      this.amount = amount;
    }

    const label = this.getResponseProperty("Label");
    if (label != null) {
      this.label = label;
    }
  }
}
