import { Discount, DiscountType, DiscountTypes } from "@bitwarden/pricing";

import { BaseResponse } from "../../../models/response/base.response";

export class DiscountResponse extends BaseResponse implements Discount {
  type: DiscountType;
  value: number;

  constructor(response: any) {
    super(response);

    const type = this.getResponseProperty("Type");
    if (type !== DiscountTypes.AmountOff && type !== DiscountTypes.PercentOff) {
      throw new Error(`Failed to parse invalid discount type: ${type}`);
    }
    this.type = type;
    this.value = this.getResponseProperty("Value");
  }
}
