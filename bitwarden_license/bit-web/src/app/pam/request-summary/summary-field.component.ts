import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * One label-over-value row of the request-details card. Every row uses it, so label and value
 * sit on one left edge with one vertical rhythm, and a value can be rich — a two-tone
 * name-then-email or a status badge.
 */
@Component({
  selector: "pam-summary-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-flex tw-flex-col" },
  template: `
    <span class="tw-text-sm/5 tw-font-medium">{{ label() }}</span>
    <span class="tw-text-sm/5"><ng-content /></span>
  `,
})
export class SummaryFieldComponent {
  readonly label = input.required<string>();
}
