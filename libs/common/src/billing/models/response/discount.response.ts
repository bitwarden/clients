import type { Discount, DiscountType } from "@bitwarden/pricing";

import { BaseResponse } from "../../../models/response/base.response";

const AmountOff: DiscountType = "amount-off";
const PercentOff: DiscountType = "percent-off";

export class DiscountResponse extends BaseResponse implements Discount {
  type: DiscountType;
  value: number;

  constructor(response: any) {
    super(response);

    const type = this.getResponseProperty("Type");
    if (type !== AmountOff && type !== PercentOff) {
      throw new Error(`Failed to parse invalid discount type: ${type}`);
    }
    this.type = type;
    this.value = this.getResponseProperty("Value");
  }
}
