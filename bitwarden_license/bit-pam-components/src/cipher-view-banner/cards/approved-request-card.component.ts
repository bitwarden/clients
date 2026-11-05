import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from "@angular/core";

import {
  type AccessRequestView,
  ACCESS_BADGE_LOOK,
  formatCalendarDate,
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

/** An approved request the requester has not started yet. */
@Component({
  selector: "app-pam-approved-request-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [AsyncActionsModule, ButtonModule, CardComponent, BannerCardHeaderComponent, I18nPipe],
  templateUrl: "./approved-request-card.component.html",
})
export class ApprovedRequestCardComponent {
  readonly request = input.required<AccessRequestView>();
  /** The banner's clock, so "today" turns over with it. */
  readonly nowMs = input.required<number>();
  readonly startAction = input.required<FunctionReturningAwaitable>();

  private readonly i18nService = inject(I18nService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly badgeLook = ACCESS_BADGE_LOOK;
  protected readonly popupLayout = injectPopupLayout();

  /** "…until 4:45 PM today." while the approved window ends on the current day, else its date too. */
  protected readonly accessUntilLabel = computed(() => {
    const endMs = Date.parse(this.request().leaseNotAfter);
    const time = formatTimeOfDay(this.locale, endMs);
    if (toDateInputValue(new Date(endMs)) === toDateInputValue(new Date(this.nowMs()))) {
      return this.i18nService.t("pamApprovedAccessUntilToday", time);
    }
    return this.i18nService.t(
      "pamApprovedAccessUntil",
      time,
      formatCalendarDate(this.locale, endMs),
    );
  });
}
