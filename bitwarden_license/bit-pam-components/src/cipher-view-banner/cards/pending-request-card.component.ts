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
import { CardComponent, IconTileComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** A request waiting on an approver, with how long ago it was sent. */
@Component({
  selector: "app-pam-pending-request-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, IconTileComponent, TypographyModule, I18nPipe],
  template: `
    <bit-card class="tw-mb-5 bit-compact:tw-mb-4" data-testid="cipher-view-banner-pending">
      <div class="tw-flex tw-items-start tw-gap-2">
        <bit-icon-tile [icon]="badgeLook.pending.icon" variant="warning" size="base" />
        <div class="tw-flex tw-min-w-0 tw-grow tw-flex-col tw-text-fg-body">
          <h3 bitTypography="body2" class="tw-m-0 tw-font-medium tw-text-fg-heading">
            {{ "pamPendingRequestBannerHeading" | i18n }}
          </h3>
          @if (submittedLabel(); as submitted) {
            <span
              bitTypography="helper"
              class="tw-text-fg-body"
              data-testid="cipher-view-banner-pending-submitted"
            >
              {{ submitted }}
            </span>
          }
        </div>
      </div>
    </bit-card>
  `,
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
