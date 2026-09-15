import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ButtonModule, DialogRef } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ShareLinkService } from "../../services/share-link.service";

/**
 * Share entry point for a single vault item, rendered as a button.
 *
 * Drop it wherever an item is on screen and it decides the rest for itself — whether the item can
 * be shared at all, what the button says, and what happens on click. It renders nothing when the
 * item cannot be shared, so hosts need no surrounding condition.
 */
@Component({
  selector: "app-share-button",
  templateUrl: "./share-button.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, I18nPipe],
  // Hosts previously placed the button element itself. A custom element defaults to `inline`, so
  // without this the wrapper would change how the block-level button lays out.
  host: { class: "tw-block" },
})
export class ShareButtonComponent {
  /** The item to share. */
  readonly cipher = input.required<CipherViewLike>();

  private readonly shareLinkService = inject(ShareLinkService);

  /** The dialog this button sits in, when it sits in one. */
  private readonly hostDialog = inject(DialogRef, { optional: true });

  protected readonly canShare = toSignal(
    toObservable(this.cipher).pipe(
      switchMap((cipher) => this.shareLinkService.cipherCanBeShared$(cipher)),
    ),
    { initialValue: false },
  );

  protected async share(): Promise<void> {
    await this.shareLinkService.openShareForm(this.cipher(), this.hostDialog);
  }
}
