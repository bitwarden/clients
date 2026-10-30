import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from "@angular/core";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BadgeComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  AccessRequestView,
  durationLabel,
  HISTORY_OUTCOME_BADGES,
  historyDateTime,
  historyDecisionSummary,
  HistoryOutcome,
  historyWindowRange,
  reasonText,
} from "../..";
import { RelativeTimePipe } from "../../date/relative-time.pipe";
import { DetailFieldComponent } from "../../request-detail/detail-field.component";
import { DetailSectionComponent } from "../../request-detail/detail-section.component";
import { RequestItemCardComponent } from "../../request-detail/request-item-card.component";

/**
 * The read-only body of the request dialog for a closed request opened from the History tab: the
 * item card with the outcome's badge, the request's Details, and, once anything was decided or
 * resolved, its Decision.
 */
@Component({
  selector: "pam-history-request-detail",
  templateUrl: "./history-request-detail.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-flex tw-flex-col tw-gap-6" },
  imports: [
    BadgeComponent,
    DetailFieldComponent,
    DetailSectionComponent,
    RequestItemCardComponent,
    I18nPipe,
    RelativeTimePipe,
  ],
})
export class HistoryRequestDetailComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly request = input.required<AccessRequestView>();
  readonly outcome = input.required<HistoryOutcome>();
  readonly cipher = input<CipherViewLike | null>(null);
  readonly itemName = input.required<string>();
  readonly organizationName = input<string | null>(null);
  readonly collectionName = input<string | null>(null);
  readonly requesterName = input.required<string>();
  /** The clock the window's year is judged against; the dialog hands in its own tick. */
  readonly nowMs = input<number>(Date.now());

  protected readonly badge = computed(() => HISTORY_OUTCOME_BADGES[this.outcome()]);

  protected readonly duration = computed(() => durationLabel(this.request()));

  protected readonly windowRange = computed(() =>
    historyWindowRange(this.request(), this.locale, this.nowMs()),
  );

  protected readonly reason = computed(() => reasonText(this.request()));

  protected readonly submitted = computed(() =>
    historyDateTime(this.request().submittedAt, this.locale),
  );

  protected readonly resolvedAt = computed(() => this.request().resolvedAt ?? null);

  protected readonly resolvedExact = computed(() => {
    const resolvedAt = this.resolvedAt();
    return resolvedAt == null ? "" : historyDateTime(resolvedAt, this.locale);
  });

  protected readonly decision = computed(() =>
    historyDecisionSummary(this.request(), this.outcome()),
  );

  protected readonly showDecision = computed(
    () => this.decision() != null || this.resolvedAt() != null,
  );
}
