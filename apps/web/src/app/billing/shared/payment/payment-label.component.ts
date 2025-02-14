// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { booleanAttribute, Component, Input } from "@angular/core";

import { FormFieldModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

/**
 * Label that should be used for elements loaded via Stripe API.
 *
 * Applies the same label styles from CL form-field component
 */
@Component({
  selector: "app-payment-label",
  templateUrl: "./payment-label.component.html",
  standalone: true,
  imports: [FormFieldModule, SharedModule],
})
export class PaymentLabelComponent {
  /** `id` of the associated input */
  @Input({ required: true }) for: string;
  /** Displays required text on the label */
  @Input({ transform: booleanAttribute }) required = false;

  constructor() {}
}
