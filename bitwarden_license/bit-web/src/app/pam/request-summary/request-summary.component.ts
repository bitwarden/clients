import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { IconComponent as VaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  CardComponent,
  FormFieldModule,
  IconModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { LabelValue } from "../helpers/approval-window";

import { SummaryFieldComponent } from "./summary-field.component";

/**
 * The item + "Request details" cards shared by the approver's decide dialog and the requester's
 * `/pam/requests/:id` page, so the two surfaces cannot describe the same request differently.
 *
 * Purely presentational: every value arrives already resolved and already reduced to an i18n
 * `{ key, value }` pair by the shared `helpers/approval-window` builders. It resolves nothing and
 * injects no data service, which is what lets the dialog feed it straight off an `ApprovalRow`
 * while the detail page feeds it off the values it already computes.
 *
 * Fields only one surface carries — Status, Submitted, Resolved — are projected through the
 * `<ng-content>` slot inside the request-details card rather than added as inputs, so they land in
 * the same card instead of growing a fourth one.
 */
@Component({
  selector: "pam-request-summary",
  templateUrl: "./request-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    FormFieldModule,
    IconModule,
    TypographyModule,
    SummaryFieldComponent,
    VaultIconComponent,
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
  readonly duration = input<LabelValue | null>(null);
  readonly relativeStart = input<LabelValue | null>(null);
  /** The fully-formatted window, shown on hover behind the coarse "4 hours, tomorrow" label. */
  readonly exactWindow = input<string>("");
  readonly reason = input<string | null>(null);

  /**
   * Suppressed when the requester has no name, because `requesterName` already falls back to the
   * email — rendering both would read "grace@example.com <grace@example.com>".
   */
  protected readonly secondaryEmail = computed(() => {
    const email = this.requesterEmail();
    return email == null || email === this.requesterName() ? null : email;
  });

  /** "4 hours, starting tomorrow" — the two window labels the shared helpers produce, joined once. */
  protected readonly accessRequested = computed(() =>
    [this.duration(), this.relativeStart()]
      .filter((label): label is LabelValue => label != null)
      .map((label) => this.i18nService.t(label.key, label.value ?? undefined))
      .join(", "),
  );

  protected readonly quotedReason = computed(() => {
    const reason = this.reason();
    return reason == null ? "" : `“${reason}”`;
  });
}
