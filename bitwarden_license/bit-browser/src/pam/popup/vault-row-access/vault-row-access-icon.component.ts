import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { of, switchMap } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BitwardenIcon, IconComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BrowserVaultRowAccessService } from "./browser-vault-row-access.service";
import { VaultRowAccessStatus } from "./vault-row-access-status";

/**
 * Binds `VAULT_ROW_ICON`: the privileged-control status icon in a popup row's name line. The
 * privileged-control lock for a request or unavailable item, a clock while pending, a closed lock
 * when ready and an open lock in use. Renders nothing for an item privileged control does not
 * govern.
 */
@Component({
  selector: "pam-vault-row-access-icon",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, I18nPipe],
  // `tw-block`: inline, the icon would sit on a line of the row's font and outgrow the name.
  template: `
    @if (icon(); as icon) {
      <bit-icon
        [name]="icon"
        class="tw-block bwi-sm tw-text-muted"
        [title]="'pamAccessBadgePrivileged' | i18n"
        [attr.data-testid]="'vault-row-access-icon-' + status()?.kind"
        aria-hidden="true"
      ></bit-icon>
    }
  `,
})
export class VaultRowAccessIconComponent {
  readonly cipher = input<CipherViewLike | null>(null);

  private readonly rowAccess = inject(BrowserVaultRowAccessService);

  protected readonly status = toSignal(
    toObservable(this.cipher).pipe(
      switchMap((cipher) => (cipher == null ? of(null) : this.rowAccess.status$(cipher))),
    ),
    { initialValue: null as VaultRowAccessStatus | null },
  );

  protected readonly icon = computed((): BitwardenIcon | null => {
    switch (this.status()?.kind) {
      case "request":
      case "unavailable":
        return "bwi-lock-encrypted";
      case "pending":
        return "bwi-clock";
      case "ready":
        return "bwi-lock";
      case "active":
        return "bwi-unlock";
      default:
        return null;
    }
  });
}
