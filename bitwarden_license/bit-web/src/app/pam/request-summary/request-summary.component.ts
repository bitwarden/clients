import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";

import { IconComponent as VaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import type { LabelValue } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { CardComponent, IconModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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
  readonly duration = input<string | null>(null);
  readonly relativeStart = input<LabelValue | null>(null);
  /** The fully-formatted "from – to" window, shown as a second line under the coarse "4 hours, tomorrow" label. */
  readonly exactWindow = input<string>("");
  readonly reason = input<string | null>(null);

  /**
   * Render the item card alone. The withdraw confirmation reuses this component only to keep the
   * item on screen; repeating the request's fields there would bury the decision being asked for.
   */
  readonly hideDetails = input(false, { transform: booleanAttribute });

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
