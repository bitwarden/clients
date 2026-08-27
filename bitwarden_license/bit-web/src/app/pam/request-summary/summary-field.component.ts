import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * One label-over-value row of the request-details card, for a value a read-only `bit-form-field`
 * cannot carry: that renders its value through a projected `input`/`select`/`textarea`
 * (`libs/components/src/input/input.directive.ts`), so it is a single text run and cannot hold the
 * design's two-tone name-then-email or a status badge. The label styling is copied from
 * `bit-form-field` so a row like this cannot drift from the read-only fields beside it.
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
