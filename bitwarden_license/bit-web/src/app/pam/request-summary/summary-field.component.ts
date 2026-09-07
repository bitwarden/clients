import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * One label-over-value row of the request-details card, for a value a read-only
 * `bit-form-field` can't carry — it renders through a projected `input`/`select`/`textarea`, so
 * it's a single text run and can't hold a two-tone name-then-email or a status badge.
 *
 * Label styling is copied from `bit-form-field` so this row can't drift from the read-only
 * fields beside it.
 */
@Component({
  selector: "pam-summary-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-flex tw-flex-col" },
  template: `
    <span class="tw-text-sm/5 tw-font-medium">{{ label() }}</span>
    <span class="tw-px-1 tw-text-sm/5"><ng-content /></span>
  `,
})
export class SummaryFieldComponent {
  readonly label = input.required<string>();
}
