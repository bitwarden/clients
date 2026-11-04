import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  FunctionReturningAwaitable,
  IconTileComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** An approved request the requester has not started yet. */
@Component({
  selector: "app-pam-approved-request-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CardComponent,
    IconTileComponent,
    TypographyModule,
    I18nPipe,
  ],
  template: `
    <bit-card class="tw-mb-5 bit-compact:tw-mb-4" data-testid="cipher-view-banner-approved">
      <div class="tw-flex tw-flex-col tw-gap-4">
        <div class="tw-flex tw-items-start tw-gap-2">
          <bit-icon-tile [icon]="badgeLook.ready.icon" variant="success" size="base" />
          <div class="tw-flex tw-min-w-0 tw-grow tw-flex-col tw-text-fg-body">
            <h3 bitTypography="body2" class="tw-m-0 tw-font-medium tw-text-fg-heading">
              {{ "pamApprovedRequestBannerHeadingV2" | i18n }}
            </h3>
            <span
              bitTypography="helper"
              class="tw-text-fg-body"
              data-testid="cipher-view-banner-approved-hint"
            >
              {{ "pamApprovedRequestBannerHint" | i18n }}
            </span>
          </div>
        </div>

        <button
          type="button"
          bitButton
          buttonType="primary"
          class="tw-w-full"
          [bitAction]="startAction()"
          id="pam-cipher-view-banner_button_start"
        >
          {{ "pamStartLeaseButton" | i18n }}
        </button>
      </div>
    </bit-card>
  `,
})
export class ApprovedRequestCardComponent {
  readonly startAction = input.required<FunctionReturningAwaitable>();

  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}
