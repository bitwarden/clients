import type { DiscountType, InvoicePreviewDiscount } from "@bitwarden/pricing";

import { BaseResponse } from "../../../models/response/base.response";

const AmountOff: DiscountType = "amount-off";
const PercentOff: DiscountType = "percent-off";

/**
 * Parses the preview contract's `InvoicePreviewDiscount` record. Deliberately separate from the
 * legacy {@link DiscountResponse}: the preview contract's `Value` is always dollars or a
 * whole-number percent (never cents), and its `Amount` — the applied amount Stripe computed —
 * is required, so its absence is a parse failure rather than a degrade-to-derivation case.
 */
export class InvoicePreviewDiscountResponse extends BaseResponse implements InvoicePreviewDiscount {
  type: DiscountType;
  value: number;
  amount: number;
  label?: string;

  constructor(response: any) {
    super(response);

    const type = this.getResponseProperty("Type");
    if (type !== AmountOff && type !== PercentOff) {
      throw new Error(`Failed to parse invalid discount type: ${type}`);
    }
    this.type = type;

    this.value = this.getResponseProperty("Value");

    // `== null` rather than falsy: a fully-consumed coupon can legitimately apply $0.
    const amount = this.getResponseProperty("Amount");
    if (amount == null) {
      throw new Error("Failed to parse invoice preview discount: missing Amount");
    }
    this.amount = amount;

    const label = this.getResponseProperty("Label");
    if (label != null) {
      this.label = label;
    }
  }
}
