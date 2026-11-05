import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { VAULT_ROW_ACCESS, VaultRowAccess, VaultRowAccessStatus } from "./vault-row-access.token";

/** Separates the status from the username in a row's subtitle, as in "8h left • frodo@shire.com". */
const SEPARATOR = " • ";

/**
 * A popup row's subtitle. A privileged-control item leads with its status ("Request to use",
 * "Pending approval", "Ready to use", "8h left"); a live lease then appends the username its
 * revealed copy holds. Any other item shows its own subtitle.
 */
@Component({
  selector: "app-vault-row-subtitle",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ text() }}`,
})
export class VaultRowSubtitleComponent {
  readonly cipher = input<CipherViewLike | null>(null);

  private readonly i18nService = inject(I18nService);
  private readonly access: VaultRowAccess | null = inject(VAULT_ROW_ACCESS, { optional: true });
  private readonly accountService = inject(AccountService);
  private readonly revealedCipherService = inject(RevealedCipherService);

  private readonly status = toSignal(
    toObservable(this.cipher).pipe(
      switchMap((cipher) =>
        cipher == null || this.access == null ? of(null) : this.access.status$(cipher),
      ),
    ),
    { initialValue: null as VaultRowAccessStatus | null },
  );

  /** The subtitle of the live revealed copy, which the stripped list entry lacks. */
  private readonly revealedSubtitle = toSignal(
    combineLatest([
      toObservable(this.cipher),
      this.accountService.activeAccount$.pipe(getUserId),
    ]).pipe(
      switchMap(([cipher, userId]) =>
        cipher?.id == null
          ? of(undefined)
          : this.revealedCipherService.revealed$(userId).pipe(
              map((revealed) => {
                const view = revealed.get(cipher.id as CipherId);
                return view == null
                  ? undefined
                  : CipherViewLikeUtils.subtitle(view, this.i18nService);
              }),
            ),
      ),
    ),
    { initialValue: undefined },
  );

  protected readonly text = computed(() => {
    const cipher = this.cipher();
    const status = this.status();
    if (cipher == null) {
      return "";
    }
    if (status == null) {
      return CipherViewLikeUtils.subtitle(cipher, this.i18nService) ?? "";
    }
    const username = status.kind === "active" ? this.revealedSubtitle() : undefined;
    return username ? `${status.label}${SEPARATOR}${username}` : status.label;
  });
}
