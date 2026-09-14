import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ButtonModule, IconComponent, MenuModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ShareLinkService } from "../../services/share-link.service";

/**
 * Share entry point for a single vault item, rendered as a link.
 *
 * Drop it wherever an item is on screen and it decides the rest for itself — whether the item can
 * be shared at all, what the link says, and what happens on click. It renders nothing when the
 * item cannot be shared, so hosts need no surrounding condition.
 */
@Component({
  selector: "app-share-link",
  templateUrl: "./share-item-link.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, I18nPipe, IconComponent, MenuModule],
  // Hosts previously placed the link element itself. A custom element defaults to `inline`, so
  // without this the wrapper would change how the block-level button lays out.
  host: { class: "tw-block" },
})
export class ShareItemLinkComponent {
  /** The item to share. */
  readonly cipher = input.required<CipherViewLike>();
  /** Whether to show the leading icon */
  readonly showIcon = input<boolean>(true);

  private readonly shareLinkService = inject(ShareLinkService);

  protected readonly canShare = toSignal(
    toObservable(this.cipher).pipe(
      switchMap((cipher) => this.shareLinkService.cipherCanBeShared$(cipher)),
    ),
    { initialValue: false },
  );

  protected async share(): Promise<void> {
    await this.shareLinkService.openShareForm(this.cipher(), null);
  }
}
