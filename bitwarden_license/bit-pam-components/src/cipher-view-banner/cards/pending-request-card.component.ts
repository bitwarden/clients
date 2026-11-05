import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
} from "@angular/core";

import { type AccessRequestView, ACCESS_BADGE_LOOK, formatRelativeTime } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CardComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BannerCardHeaderComponent } from "./banner-card-header.component";

/** A request waiting on an approver, with how long ago it was sent and any projected action. */
@Component({
  selector: "app-pam-pending-request-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, BannerCardHeaderComponent, I18nPipe],
  templateUrl: "./pending-request-card.component.html",
})
export class PendingRequestCardComponent {
  readonly request = input.required<AccessRequestView>();
  /** The banner's clock, so the elapsed time ticks with it. */
  readonly nowMs = input.required<number>();

  private readonly i18nService = inject(I18nService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly badgeLook = ACCESS_BADGE_LOOK;

  /** "Submitted just now" for the first minute, then how long ago, e.g. "Submitted 5 minutes ago". */
  protected readonly submittedLabel = computed(() => {
    const submittedAt = this.request().submittedAt;
    const submittedMs = submittedAt == null ? Number.NaN : Date.parse(submittedAt);
    if (!Number.isFinite(submittedMs)) {
      return null;
    }
    const nowMs = this.nowMs();
    if (nowMs - submittedMs < 60_000) {
      return this.i18nService.t("pamPendingSubmittedJustNow");
    }
    return this.i18nService.t(
      "pamPendingSubmittedAgo",
      formatRelativeTime(
        submittedMs,
        nowMs,
        new Intl.RelativeTimeFormat(this.locale, { numeric: "auto" }),
      ),
    );
  });
}
