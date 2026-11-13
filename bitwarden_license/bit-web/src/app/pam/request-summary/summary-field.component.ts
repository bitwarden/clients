import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * One label-over-value row of the request-details card. The value is projected, so it can be
 * rich, such as a name with its email or a status badge.
 */
@Component({
  selector: "pam-summary-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-flex tw-flex-col tw-gap-1.5" },
  template: `
    <span class="tw-text-sm tw-font-semibold tw-text-muted">{{ label() }}</span>
    <span class="tw-text-base tw-text-main"><ng-content /></span>
  `,
})
export class SummaryFieldComponent {
  readonly label = input.required<string>();
}
