import { inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * The IDs of the active user's ciphers with a live revealed view, for a row to tell a gated item
 * (restricted, nothing revealed) from one in use (restricted, revealed). Call in an injection context.
 */
export function revealedCipherIds(): Signal<ReadonlySet<string>> {
  const accountService = inject(AccountService);
  const revealedCipherService = inject(RevealedCipherService);
  const noneRevealed: ReadonlySet<string> = new Set<string>();
  return toSignal(
    accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => revealedCipherService.revealed$(userId)),
      map((revealed): ReadonlySet<string> => new Set<string>([...revealed.keys()].map(String))),
    ),
    { initialValue: noneRevealed },
  );
}

/** A restricted cipher with no live revealed view: its credentials are not available to act on. */
export function isGatedRow(cipher: CipherViewLike, revealedIds: ReadonlySet<string>): boolean {
  return (
    CipherViewLikeUtils.isRestricted(cipher) &&
    (cipher.id == null || !revealedIds.has(String(cipher.id)))
  );
}
