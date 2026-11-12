import { DestroyRef, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subscription, distinctUntilChanged, map, take } from "rxjs";

import { GatedRequestActionsService } from "@bitwarden/bit-pam-components";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItemsTableRowAction } from "@bitwarden/vault";

/** How long a row's answer is trusted before the next ask re-reads it. */
const STALE_MS = 5000;

/**
 * The PAM entries of the desktop vault's row menu, bound to `VAULT_ROW_ACTIONS`. Today that is
 * "Cancel request" on a gated row whose owner has a pending or approved, unstarted request, which
 * is the desktop counterpart of the web vault's `VaultRowAccessActionsService`.
 *
 * The menu asks `show` synchronously for every rendered row, so the answer is read from a snapshot
 * of what each row last reported. An ask with no fresh answer starts one single-shot read,
 * scheduled on a microtask since `show` may not write a signal, and releases it as soon as it
 * answers, so no read stays open per row and a push costs nothing. Until the read lands the
 * previous answer (or hidden) stands, and an answer older than a few seconds is read again.
 */
export class DesktopVaultRowActionsService {
  /** Whether a request can be withdrawn, by cipher id, as each row last reported. */
  private readonly cancelable = signal<ReadonlyMap<string, boolean>>(new Map());

  /** When each row's answer was last requested, and the read in flight for it, if any. */
  private readonly reads = new Map<string, { at: number; subscription: Subscription }>();

  constructor(
    private readonly gatedRequestActions: GatedRequestActionsService,
    private readonly i18nService: I18nService,
    accountService: AccountService,
    destroyRef: DestroyRef,
  ) {
    // The renderer outlives an account switch, so the previous account's answers go with it.
    accountService.activeAccount$
      .pipe(
        map((account) => account?.id ?? null),
        distinctUntilChanged(),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.reset());
    destroyRef.onDestroy(() => this.reset());
  }

  /** The contributed menu entries, in the order the table places them. */
  rowActions(): readonly VaultItemsTableRowAction<CipherViewLike>[] {
    return [
      {
        id: "pamCancelRequest",
        label: this.i18nService.t("pendingStateCancelRequest"),
        icon: "bwi-close",
        show: (cipher) => this.canCancel(cipher),
        run: (cipher) => this.gatedRequestActions.cancelRequest(cipher),
      },
    ];
  }

  private canCancel(cipher: CipherViewLike): boolean {
    if (!CipherViewLikeUtils.isRestricted(cipher) || cipher.id == null) {
      return false;
    }
    const cipherId = String(cipher.id);
    const read = this.reads.get(cipherId);
    if (read == null || Date.now() - read.at > STALE_MS) {
      const at = Date.now();
      read?.subscription.unsubscribe();
      this.reads.set(cipherId, { at, subscription: Subscription.EMPTY });
      queueMicrotask(() => this.read(cipherId, cipher, at));
    }
    return this.cancelable().get(cipherId) === true;
  }

  private read(cipherId: string, cipher: CipherViewLike, at: number): void {
    // Cleared by a reset, or superseded, between the ask and this microtask.
    if (this.reads.get(cipherId)?.at !== at) {
      return;
    }
    const subscription = this.gatedRequestActions
      .cancelableRequest$(cipher)
      .pipe(take(1))
      .subscribe((cancelable) => {
        this.cancelable.update((current) =>
          current.get(cipherId) === cancelable
            ? current
            : new Map(current).set(cipherId, cancelable),
        );
      });
    // A synchronous answer has already finished, leaving nothing to hold.
    this.reads.set(cipherId, { at, subscription });
  }

  private reset(): void {
    this.reads.forEach((read) => read.subscription.unsubscribe());
    this.reads.clear();
    this.cancelable.set(new Map());
  }
}
