import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import {
  CardComponent,
  IconModule,
  IconTileComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DurationLongPipe } from "../../date/duration-long.pipe";
import type { RequestTerms } from "../request-terms";

/** The resting state of an item the user can request, with the rule's cap when it is known. */
@Component({
  selector: "app-pam-request-access-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [
    CardComponent,
    IconModule,
    IconTileComponent,
    TypographyModule,
    DurationLongPipe,
    I18nPipe,
  ],
  template: `
    <bit-card class="tw-mb-5 bit-compact:tw-mb-4" data-testid="cipher-view-banner-request">
      <div class="tw-flex tw-flex-col tw-gap-4">
        <div class="tw-flex tw-items-start tw-gap-2">
          <bit-icon-tile [icon]="badgeLook.privileged.icon" variant="primary" size="base" />
          <div class="tw-flex tw-min-w-0 tw-grow tw-flex-col tw-text-fg-body">
            <h3 bitTypography="body2" class="tw-m-0 tw-font-medium tw-text-fg-heading">
              {{ "pamRequestAccessBannerHeading" | i18n }}
            </h3>
            <p bitTypography="helper" class="tw-m-0 tw-text-fg-body">
              {{ "pamRequestAccessBannerBody" | i18n }}
            </p>
          </div>
        </div>

        @if (terms(); as rule) {
          <p
            bitTypography="helper"
            class="tw-m-0 tw-flex tw-items-center tw-gap-2 tw-text-fg-heading"
            data-testid="cipher-view-banner-max-duration"
          >
            <bit-icon name="bwi-clock" />
            {{ rule.messageKey | i18n: (rule.maxSeconds | durationLong) }}
          </p>
        }
      </div>
    </bit-card>
  `,
})
export class RequestAccessCardComponent {
  readonly terms = input<RequestTerms | null>(null);

  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}
