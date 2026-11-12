import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { of, switchMap } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { VAULT_ROW_SUBTITLE, VaultRowSubtitle } from "./vault-row-subtitle.token";

/** A popup row's subtitle: the {@link VAULT_ROW_SUBTITLE} provider's text, else the cipher's own. */
@Component({
  selector: "app-vault-row-subtitle",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ text() }}`,
})
export class VaultRowSubtitleComponent {
  readonly cipher = input<CipherViewLike | null>(null);

  private readonly i18nService = inject(I18nService);
  private readonly provider: VaultRowSubtitle | null = inject(VAULT_ROW_SUBTITLE, {
    optional: true,
  });

  private readonly contributed = toSignal(
    toObservable(this.cipher).pipe(
      switchMap((cipher) =>
        cipher == null || this.provider == null ? of(null) : this.provider.subtitle$(cipher),
      ),
    ),
    { initialValue: null },
  );

  protected readonly text = computed(() => {
    const cipher = this.cipher();
    if (cipher == null) {
      return "";
    }
    return this.contributed() ?? CipherViewLikeUtils.subtitle(cipher, this.i18nService) ?? "";
  });
}
