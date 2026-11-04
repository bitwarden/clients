import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import { CardComponent, IconTileComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** Explains why the item went back to masked after a lease ran out on its own. */
@Component({
  selector: "app-pam-access-ended-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, IconTileComponent, TypographyModule, I18nPipe],
  template: `
    <bit-card class="tw-mb-5 bit-compact:tw-mb-4" data-testid="cipher-view-banner-ended">
      <div class="tw-flex tw-items-start tw-gap-2">
        <bit-icon-tile [icon]="badgeLook.expired.icon" variant="gray" size="base" />
        <div class="tw-flex tw-min-w-0 tw-grow tw-flex-col tw-text-fg-body">
          <h3 bitTypography="body2" class="tw-m-0 tw-font-medium tw-text-fg-heading">
            {{ "pamEndedBannerHeading" | i18n }}
          </h3>
          <span bitTypography="helper" class="tw-text-fg-body">
            {{ "pamEndedBannerBody" | i18n }}
          </span>
        </div>
      </div>
    </bit-card>
  `,
})
export class AccessEndedCardComponent {
  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}
