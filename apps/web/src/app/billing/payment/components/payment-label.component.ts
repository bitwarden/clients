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
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
        <span class="tw-text-[0.625rem] tw-font-normal">({{ "required" | i18n }})</span>
      </bit-label>
    </div>
  `,
  imports: [FormFieldModule, SharedModule],
})
export class PaymentLabelComponent {
  /** `id` of the associated input */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) for: string;
  /** Displays required text on the label */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: booleanAttribute }) required = false;

  constructor() {}
}
