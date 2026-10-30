import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { IconComponent as VaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { CardComponent, IconModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The identity card heading a request's detail dialog: the gated item's icon and name, its
 * organization and collection, and the request's status projected through `slot="badge"`.
 */
@Component({
  selector: "pam-request-item-card",
  templateUrl: "./request-item-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconModule, TypographyModule, VaultIconComponent, I18nPipe],
})
export class RequestItemCardComponent {
  /** The decrypted gated cipher, for the favicon; null falls back to a generic key icon. */
  readonly cipher = input<CipherViewLike | null>(null);
  readonly itemName = input.required<string>();
  readonly organizationName = input<string | null>(null);
  readonly collectionName = input<string | null>(null);
}
