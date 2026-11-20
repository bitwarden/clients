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
  CalloutModule,
  CardComponent,
  FunctionReturningAwaitable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { injectPopupLayout } from "../cipher-view-banner-layout";

import { BannerCardHeaderComponent } from "./banner-card-header.component";

/** Stands in for the time while the message is split, so only the time renders bold. */
const TIME_MARK = "\u0000time\u0000";

/** An approved request the requester has not started yet. */
@Component({
  selector: "app-pam-approved-request-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CardComponent,
    BannerCardHeaderComponent,
    I18nPipe,
  ],
  templateUrl: "./approved-request-card.component.html",
})
export class ApprovedRequestCardComponent {
  readonly request = input.required<AccessRequestView>();
  /** The banner's clock, so "today" turns over with it. */
  readonly nowMs = input.required<number>();
  readonly startAction = input.required<FunctionReturningAwaitable>();
  /**
   * When another member's lease on the single-active-lease slot ends; `null` while the slot is
   * free. Set disables Start access and shows why above it.
   */
  readonly startBlockedUntil = input<string | null>(null);

  private readonly i18nService = inject(I18nService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly badgeLook = ACCESS_BADGE_LOOK;
  protected readonly itemInUseCalloutId = "pam-cipher-view-banner_callout_item-in-use";
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

  protected readonly startBlocked = computed(() => this.startBlockedUntil() != null);

  /**
   * "…You can start access at 8:45 AM today." split around the time, which renders bold. Falls back
   * to the untimed message when the slot's end cannot be read.
   */
  protected readonly itemInUseMessage = computed(() => {
    const freesAt = this.startBlockedUntil();
    if (freesAt == null) {
      return null;
    }
    const freesAtMs = Date.parse(freesAt);
    if (Number.isNaN(freesAtMs)) {
      return { before: this.i18nService.t("pamStartItemInUse"), time: null, after: "" };
    }
    const message =
      toDateInputValue(new Date(freesAtMs)) === toDateInputValue(new Date(this.nowMs()))
        ? this.i18nService.t("pamStartItemInUseAtToday", TIME_MARK)
        : this.i18nService.t(
            "pamStartItemInUseAt",
            TIME_MARK,
            formatCalendarDate(this.locale, freesAtMs),
          );
    const [before, after = ""] = message.split(TIME_MARK);
    return { before, time: formatTimeOfDay(this.locale, freesAtMs), after };
  });
}
