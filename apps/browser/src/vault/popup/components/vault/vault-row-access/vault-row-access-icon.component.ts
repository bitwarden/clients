import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { of, switchMap } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BitwardenIcon, IconComponent } from "@bitwarden/components";

import { VAULT_ROW_ACCESS, VaultRowAccess, VaultRowAccessStatus } from "./vault-row-access.token";

/**
 * The privileged-control status icon in a popup row's name line: the privileged-control lock for a request
 * or unavailable item, a clock while pending, a closed lock when ready and an open lock in use.
 * Renders nothing for an item privileged control does not govern.
 */
@Component({
  selector: "app-vault-row-access-icon",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (icon(); as icon) {
      <bit-icon
        [name]="icon"
        class="bwi-sm tw-text-muted"
        [attr.data-testid]="'vault-row-access-icon-' + status()?.kind"
        aria-hidden="true"
      ></bit-icon>
    }
  `,
})
export class VaultRowAccessIconComponent {
  readonly cipher = input<CipherViewLike | null>(null);

  private readonly access: VaultRowAccess | null = inject(VAULT_ROW_ACCESS, { optional: true });

  protected readonly status = toSignal(
    toObservable(this.cipher).pipe(
      switchMap((cipher) =>
        cipher == null || this.access == null ? of(null) : this.access.status$(cipher),
      ),
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
