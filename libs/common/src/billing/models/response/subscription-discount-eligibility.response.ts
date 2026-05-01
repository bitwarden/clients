import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import {
  SubscriptionDiscount,
  SubscriptionDiscountResponse,
} from "./subscription-discount.response";

export interface SubscriptionDiscountEligibility {
  cartLevelDiscounts: SubscriptionDiscount[];
  itemLevelDiscounts: SubscriptionDiscount[];
}

export class SubscriptionDiscountEligibilityResponse
  extends BaseResponse
  implements SubscriptionDiscountEligibility
{
  cartLevelDiscounts: SubscriptionDiscount[];
  itemLevelDiscounts: SubscriptionDiscount[];

  constructor(response: any) {
    super(response);
    const cartLevelDiscounts = this.getResponseProperty("CartLevelDiscounts");
    const itemLevelDiscounts = this.getResponseProperty("ItemLevelDiscounts");
    this.cartLevelDiscounts = (cartLevelDiscounts ?? []).map(
      (item: any) => new SubscriptionDiscountResponse(item),
    );
    this.itemLevelDiscounts = (itemLevelDiscounts ?? []).map(
      (item: any) => new SubscriptionDiscountResponse(item),
    );
  }
}
