import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { CardComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { LabelValue } from "../helpers/approval-window";

import { RequestItemCardComponent } from "./request-item-card.component";
import { SummaryFieldComponent } from "./summary-field.component";

/**
 * The item and "Request details" cards shared by the decide dialog and the `/pam/requests/:id`
 * dialog. Fields only one surface carries (Status, Submitted, Resolved) are projected through
 * `<ng-content>`.
 */
@Component({
  selector: "pam-request-summary",
  templateUrl: "./request-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    TypographyModule,
    RequestItemCardComponent,
    SummaryFieldComponent,
    I18nPipe,
  ],
})
export class RequestSummaryComponent {
  private readonly i18nService = inject(I18nService);

  /** The decrypted gated cipher, for the favicon; null falls back to a generic key icon. */
  readonly cipher = input<CipherViewLike | null>(null);
  readonly itemName = input.required<string>();
  readonly organizationName = input<string | null>(null);
  readonly collectionName = input<string | null>(null);
  readonly requesterName = input.required<string>();
  readonly requesterEmail = input<string | null>(null);
  readonly duration = input<string | null>(null);
  readonly relativeStart = input<LabelValue | null>(null);
  /** The fully-formatted "from – to" window, shown as a second line under the coarse "4 hours, tomorrow" label. */
  readonly exactWindow = input<string>("");
  readonly reason = input<string | null>(null);

  /** The window labels joined, e.g. "4 hours, starting tomorrow". */
  protected readonly accessRequested = computed(() => {
    const start = this.relativeStart();
    return [
      this.duration(),
      start == null ? null : this.i18nService.t(start.key, start.value ?? undefined),
    ]
      .filter((label): label is string => !!label)
      .join(", ");
  });

  protected readonly quotedReason = computed(() => {
    const reason = this.reason();
    return reason == null ? "" : `“${reason}”`;
  });
}
