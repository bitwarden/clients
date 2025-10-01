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
  template: `
    <ng-template #defaultContent>
      <ng-content></ng-content>
    </ng-template>

    <div class="tw-relative tw-mt-2">
      <bit-label
        [attr.for]="for"
        class="tw-absolute tw-bg-background tw-px-1 tw-text-sm tw-text-muted -tw-top-2.5 tw-left-3 tw-mb-0 tw-max-w-full tw-pointer-events-auto"
      >
        <ng-container *ngTemplateOutlet="defaultContent"></ng-container>
        <span class="tw-text-xs tw-font-normal">({{ "required" | i18n }})</span>
      </bit-label>
    </div>
  `,
  imports: [FormFieldModule, SharedModule],
})
export class PaymentLabelComponent {
  /** `id` of the associated input */
  @Input({ required: true }) for: string;
  /** Displays required text on the label */
  @Input({ transform: booleanAttribute }) required = false;

  constructor() {}
}
