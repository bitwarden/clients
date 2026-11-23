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
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { injectPopupLayout } from "../cipher-view-banner-layout";

import { BannerCardHeaderComponent } from "./banner-card-header.component";

/** The live lease's countdown, with Extend and End until its last minutes. */
@Component({
  selector: "app-pam-active-lease-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [AsyncActionsModule, ButtonModule, CardComponent, BannerCardHeaderComponent, I18nPipe],
  templateUrl: "./active-lease-card.component.html",
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
  protected readonly popupLayout = injectPopupLayout();

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
