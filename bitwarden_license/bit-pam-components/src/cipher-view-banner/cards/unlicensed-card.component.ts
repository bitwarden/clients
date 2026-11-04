import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import { CardComponent, IconTileComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The licensing block, which replaces every other state. */
@Component({
  selector: "app-pam-unlicensed-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, IconTileComponent, TypographyModule, I18nPipe],
  template: `
    <bit-card class="tw-mb-5 bit-compact:tw-mb-4" data-testid="cipher-view-banner-unlicensed">
      <div class="tw-flex tw-items-start tw-gap-2">
        <bit-icon-tile [icon]="badgeLook.privileged.icon" variant="primary" size="base" />
        <div class="tw-flex tw-min-w-0 tw-grow tw-flex-col tw-text-fg-body">
          <h3 bitTypography="body2" class="tw-m-0 tw-font-medium tw-text-fg-heading">
            {{ "pamUnlicensedBannerHeadingV2" | i18n }}
          </h3>
          <p bitTypography="helper" class="tw-m-0 tw-text-fg-body">
            {{ "pamUnlicensedBannerBodyV2" | i18n }}
          </p>
        </div>
      </div>
    </bit-card>
  `,
})
export class UnlicensedCardComponent {
  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}
