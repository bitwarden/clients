import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from "@angular/core";

import {
  type AccessLeaseView,
  ACCESS_BADGE_LOOK,
  ENDING_SOON_THRESHOLD_MS,
  formatCalendarDate,
  formatRemainingLong,
  formatTimeOfDay,
  toDateInputValue,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  FunctionReturningAwaitable,
  IconTileComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The live lease's countdown, with Extend and End until its last minutes. */
@Component({
  selector: "app-pam-active-lease-card",
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
    <bit-card class="tw-mb-5 bit-compact:tw-mb-4" data-testid="cipher-view-banner-active">
      <div class="tw-flex tw-flex-col tw-gap-4">
        <div class="tw-flex tw-items-start tw-gap-2">
          <bit-icon-tile
            [icon]="endingSoon() ? badgeLook.endingSoon.icon : badgeLook.active.icon"
            [variant]="endingSoon() ? 'danger' : 'teal'"
            size="base"
          />
          <div class="tw-flex tw-min-w-0 tw-grow tw-flex-col tw-text-fg-body">
            @if (endingSoon()) {
              <h3
                bitTypography="body2"
                class="tw-m-0 tw-font-medium tw-text-fg-heading"
                data-testid="active-lease-ending-soon"
              >
                {{ "pamActiveLeaseBannerEndingSoonTitleV2" | i18n: remainingLabel() }}
              </h3>
            } @else {
              <h3
                bitTypography="body2"
                class="tw-m-0 tw-font-medium tw-text-fg-heading"
                data-testid="active-lease-countdown"
              >
                {{ "pamActiveLeaseBannerTitleV2" | i18n: remainingLabel() }}
              </h3>
            }
            <span bitTypography="helper" class="tw-text-fg-body" data-testid="active-lease-ends-at">
              {{ expiryLabel() }}
            </span>
          </div>
        </div>

        @if (!endingSoon()) {
          <div class="tw-flex tw-items-center tw-gap-2" data-testid="active-lease-actions">
            @if (canExtend()) {
              <button
                type="button"
                bitButton
                buttonType="secondary"
                class="tw-flex-1"
                [bitAction]="extendAction()"
                id="pam-cipher-view-banner_button_extend"
              >
                {{ "pamExtendLeaseButtonV2" | i18n }}
              </button>
            }
            <button
              type="button"
              bitButton
              buttonType="danger"
              class="tw-flex-1"
              [bitAction]="endAction()"
              id="pam-cipher-view-banner_button_end"
            >
              {{ "pamEndLeaseButton" | i18n }}
            </button>
          </div>
        }
      </div>
    </bit-card>
  `,
})
export class ActiveLeaseCardComponent {
  readonly lease = input.required<AccessLeaseView>();
  /** The banner's clock, so the countdown ticks with it. */
  readonly nowMs = input.required<number>();
  readonly canExtend = input(false);
  readonly extendAction = input.required<FunctionReturningAwaitable>();
  readonly endAction = input.required<FunctionReturningAwaitable>();

  private readonly i18nService = inject(I18nService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly badgeLook = ACCESS_BADGE_LOOK;

  // Parsed once per lease change, not per tick.
  private readonly expiryMs = computed(() => Date.parse(this.lease().notAfter));

  /**
   * Escalates at the access-state badge's threshold. Handled here because
   * `ItemDetailsStateBadgeComponent` drops the `active` state on this surface to keep one timer.
   */
  protected readonly endingSoon = computed(
    () => this.expiryMs() - this.nowMs() <= ENDING_SOON_THRESHOLD_MS,
  );

  protected readonly remainingLabel = computed(() =>
    formatRemainingLong(this.locale, this.expiryMs() - this.nowMs()),
  );

  /**
   * "Expires today at 4:15 pm" while the lease ends on the current day, else the date as well. The
   * time is lowercased to match the design's "pm".
   */
  protected readonly expiryLabel = computed(() => {
    const expiry = new Date(this.expiryMs());
    const time = formatTimeOfDay(this.locale, expiry.getTime()).toLocaleLowerCase(this.locale);
    if (toDateInputValue(expiry) === toDateInputValue(new Date(this.nowMs()))) {
      return this.i18nService.t("pamLeaseExpiresToday", time);
    }
    return this.i18nService.t(
      "pamLeaseExpires",
      formatCalendarDate(this.locale, expiry.getTime()),
      time,
    );
  });
}
