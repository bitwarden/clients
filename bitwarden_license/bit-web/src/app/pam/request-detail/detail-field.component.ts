import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { TypographyModule } from "@bitwarden/components";

/**
 * One label-over-value row of a {@link DetailSectionComponent}. An attribute selector on a `<div>`,
 * since a `<dl>` may only hold `<dt>`/`<dd>` groups wrapped in `<div>`s. The value is projected,
 * and wraps rather than clipping, so a long comment stays readable.
 */
@Component({
  selector: "div[pam-detail-field]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypographyModule],
  host: { class: "tw-flex tw-flex-col tw-gap-1.5" },
  template: `
    <dt bitTypography="body2" class="tw-m-0 tw-font-semibold tw-text-muted">{{ label() }}</dt>
    <dd bitTypography="body1" class="tw-m-0 tw-whitespace-pre-line tw-break-words tw-text-main">
      <ng-content />
    </dd>
  `,
})
export class DetailFieldComponent {
  readonly label = input.required<string>();
}
