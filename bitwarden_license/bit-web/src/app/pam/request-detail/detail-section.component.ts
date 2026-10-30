import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import {
  CardComponent,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

/**
 * A titled card of label-over-value rows in a request's detail dialog. Project
 * `<div pam-detail-field>` rows; they render inside a `<dl>`.
 */
@Component({
  selector: "pam-detail-section",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, SectionComponent, SectionHeaderComponent, TypographyModule],
  template: `
    <bit-section disableMargin>
      <bit-section-header>
        <h3 bitTypography="h6">{{ title() }}</h3>
      </bit-section-header>
      <bit-card>
        <dl class="tw-m-0 tw-flex tw-flex-col tw-gap-6">
          <ng-content />
        </dl>
      </bit-card>
    </bit-section>
  `,
})
export class DetailSectionComponent {
  readonly title = input.required<string>();
}
